/**
 * Fraud Graph Engine
 * Builds relationship graphs from transaction data for risk attribution
 * 
 * Nodes: accounts, customers, transactions, locations
 * Edges: transfers, shared ownership, frequent transactions
 * 
 * Output: { nodes, edges, clusters, flagged_paths }
 */

const graphLog = (message, data = null) => {
    console.log(`[GRAPH][${new Date().toISOString()}] ${message}`, data ? JSON.stringify(data).slice(0, 300) : "");
};

// ─── Graph Builder ───────────────────────────────────────────────────────────

/**
 * Build a fraud relationship graph from case transactions
 * 
 * @param {Array} transactions - Array of transaction records
 * @param {Object} customerDetails - Customer metadata from case
 * @param {Object} mlInsights - ML analysis results (if available)
 * @returns {Object} - { nodes, edges, clusters, flagged_paths }
 */
export function buildFraudGraph(transactions, customerDetails = {}, mlInsights = {}) {
    graphLog(`Building fraud graph from ${transactions.length} transactions`);

    const nodesMap = new Map();
    const edgesMap = new Map();
    const accountActivity = new Map(); // Track per-account stats

    // ─── Step 1: Extract nodes from transactions ─────────────────────────────

    for (const txn of transactions) {
        const sender = txn.senderDetails || {};
        const receiver = txn.receiverDetails || {};
        const amount = parseFloat(txn.amount) || 0;
        const txnId = txn.displayId || txn.id;

        // Transaction node
        addNode(nodesMap, txnId, "transaction", {
            amount,
            currency: txn.currency,
            timestamp: txn.timestamp,
            isFlagged: txn.isFlagged,
            category: txn.category,
        });

        // Sender account node
        const senderAccId = sender.acc_id || sender.account_id || `sender_${txnId}`;
        addNode(nodesMap, senderAccId, "account", {
            name: sender.name || "Unknown Sender",
            country: sender.country || "Unknown",
            bank: sender.bank || "",
        });

        // Receiver account node
        const receiverAccId = receiver.acc_id || receiver.account_id || `receiver_${txnId}`;
        addNode(nodesMap, receiverAccId, "account", {
            name: receiver.name || "Unknown Receiver",
            country: receiver.country || "Unknown",
            bank: receiver.bank || "",
        });

        // Location nodes for cross-border analysis
        if (sender.country) {
            addNode(nodesMap, `loc_${sender.country}`, "location", { country: sender.country });
        }
        if (receiver.country) {
            addNode(nodesMap, `loc_${receiver.country}`, "location", { country: receiver.country });
        }

        // ─── Step 2: Create edges ────────────────────────────────────────────

        // Transfer edge: sender → receiver
        const transferEdgeId = `${senderAccId}->${receiverAccId}`;
        addEdge(edgesMap, transferEdgeId, senderAccId, receiverAccId, "transfer", {
            transactionId: txnId,
            amount,
            currency: txn.currency,
            timestamp: txn.timestamp,
        });

        // Account ↔ Transaction edges
        addEdge(edgesMap, `${senderAccId}-tx-${txnId}`, senderAccId, txnId, "sent", { amount });
        addEdge(edgesMap, `${txnId}-tx-${receiverAccId}`, txnId, receiverAccId, "received", { amount });

        // Account ↔ Location edges
        if (sender.country) {
            addEdge(edgesMap, `${senderAccId}-loc-${sender.country}`, senderAccId, `loc_${sender.country}`, "located_in", {});
        }
        if (receiver.country) {
            addEdge(edgesMap, `${receiverAccId}-loc-${receiver.country}`, receiverAccId, `loc_${receiver.country}`, "located_in", {});
        }

        // Track account activity
        trackAccountActivity(accountActivity, senderAccId, amount, "sent", txn.timestamp);
        trackAccountActivity(accountActivity, receiverAccId, amount, "received", txn.timestamp);
    }

    // ─── Step 3: Add customer node ───────────────────────────────────────────

    if (customerDetails) {
        const custId = customerDetails.id || customerDetails.dbId || "subject";
        addNode(nodesMap, custId, "customer", {
            name: customerDetails.name || "Unknown",
            businessType: customerDetails.businessType || "",
            country: customerDetails.country || "",
        });
    }

    // ─── Step 4: Merge ML graph patterns ─────────────────────────────────────

    const mlGraphPatterns = mlInsights?.graph_patterns || [];
    for (const pattern of mlGraphPatterns) {
        if (pattern.nodes) {
            for (const nodeId of pattern.nodes) {
                addNode(nodesMap, nodeId, "account", { ml_flagged: true, pattern_type: pattern.pattern_type });
            }
        }
        if (pattern.links) {
            for (const link of pattern.links) {
                addEdge(edgesMap, `ml_${link.source}->${link.target}`, link.source, link.target, "ml_detected", {
                    pattern_type: pattern.pattern_type,
                });
            }
        }
    }

    // ─── Step 5: Detect clusters ─────────────────────────────────────────────

    const nodes = Array.from(nodesMap.values());
    const edges = Array.from(edgesMap.values());
    const clusters = detectClusters(nodes, edges);

    // ─── Step 6: Find flagged paths ──────────────────────────────────────────

    const flaggedPaths = findFlaggedPaths(nodes, edges, transactions, accountActivity);

    graphLog(`Graph built: ${nodes.length} nodes, ${edges.length} edges, ${clusters.length} clusters, ${flaggedPaths.length} flagged paths`);

    return {
        nodes,
        edges,
        clusters,
        flagged_paths: flaggedPaths,
        stats: {
            total_nodes: nodes.length,
            total_edges: edges.length,
            account_nodes: nodes.filter(n => n.type === "account").length,
            transaction_nodes: nodes.filter(n => n.type === "transaction").length,
            location_nodes: nodes.filter(n => n.type === "location").length,
            cross_border_edges: edges.filter(e => e.metadata?.cross_border).length,
        }
    };
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function addNode(map, id, type, metadata = {}) {
    if (map.has(id)) {
        // Merge metadata for existing nodes
        const existing = map.get(id);
        existing.metadata = { ...existing.metadata, ...metadata };
        existing.weight = (existing.weight || 1) + 1;
    } else {
        map.set(id, { id, type, metadata, weight: 1 });
    }
}

function addEdge(map, id, source, target, relationship, metadata = {}) {
    if (map.has(id)) {
        const existing = map.get(id);
        existing.weight = (existing.weight || 1) + 1;
        if (metadata.amount) {
            existing.totalAmount = (existing.totalAmount || 0) + metadata.amount;
        }
    } else {
        map.set(id, {
            id,
            source,
            target,
            relationship,
            metadata,
            weight: 1,
            totalAmount: metadata.amount || 0,
        });
    }
}

function trackAccountActivity(activityMap, accountId, amount, direction, timestamp) {
    if (!activityMap.has(accountId)) {
        activityMap.set(accountId, { sent: 0, received: 0, totalSent: 0, totalReceived: 0, timestamps: [] });
    }
    const activity = activityMap.get(accountId);
    activity[direction] += 1;
    if (direction === "sent") activity.totalSent += amount;
    else activity.totalReceived += amount;
    activity.timestamps.push(timestamp);
}

/**
 * Simple connected-component clustering using BFS
 */
function detectClusters(nodes, edges) {
    const adjacency = new Map();
    const accountNodes = nodes.filter(n => n.type === "account");

    // Build adjacency list (accounts only)
    for (const node of accountNodes) {
        adjacency.set(node.id, new Set());
    }
    for (const edge of edges) {
        if (edge.relationship === "transfer") {
            if (adjacency.has(edge.source)) adjacency.get(edge.source).add(edge.target);
            if (adjacency.has(edge.target)) adjacency.get(edge.target).add(edge.source);
        }
    }

    const visited = new Set();
    const clusters = [];

    for (const node of accountNodes) {
        if (visited.has(node.id)) continue;

        const cluster = [];
        const queue = [node.id];

        while (queue.length > 0) {
            const current = queue.shift();
            if (visited.has(current)) continue;
            visited.add(current);
            cluster.push(current);

            const neighbors = adjacency.get(current) || new Set();
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) queue.push(neighbor);
            }
        }

        if (cluster.length >= 2) {
            clusters.push({
                id: `cluster_${clusters.length + 1}`,
                members: cluster,
                size: cluster.length,
                risk_indicator: cluster.length >= 4 ? "high" : cluster.length >= 3 ? "medium" : "low",
            });
        }
    }

    if (clusters.length > 0) {
        graphLog(`[GRAPH] ${clusters.length} cluster(s) identified`);
    }

    return clusters;
}

/**
 * Identify suspicious paths through the graph
 */
function findFlaggedPaths(nodes, edges, transactions, accountActivity) {
    const flaggedPaths = [];
    const transferEdges = edges.filter(e => e.relationship === "transfer");

    // Find chains: A → B → C (2+ hop paths)
    const adjacency = new Map();
    for (const edge of transferEdges) {
        if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
        adjacency.get(edge.source).push({ target: edge.target, edge });
    }

    // BFS for chains of length >= 2
    for (const [startNode, neighbors] of adjacency) {
        for (const { target: mid, edge: edge1 } of neighbors) {
            const midNeighbors = adjacency.get(mid) || [];
            for (const { target: end, edge: edge2 } of midNeighbors) {
                if (end !== startNode) {
                    // Found a 3-node path
                    const totalAmount = (edge1.totalAmount || 0) + (edge2.totalAmount || 0);
                    let reason = "layering pattern";

                    // Check for circular flow
                    const endNeighbors = adjacency.get(end) || [];
                    if (endNeighbors.some(n => n.target === startNode)) {
                        reason = "circular transaction pattern";
                    }

                    // Check for cross-border
                    const startCountry = nodes.find(n => n.id === startNode)?.metadata?.country;
                    const endCountry = nodes.find(n => n.id === end)?.metadata?.country;
                    if (startCountry && endCountry && startCountry !== endCountry) {
                        reason = `cross-border ${reason} (${startCountry} → ${endCountry})`;
                    }

                    flaggedPaths.push({
                        path: [startNode, mid, end],
                        reason,
                        total_amount: totalAmount,
                        risk_score: totalAmount > 50000 ? 0.95 : totalAmount > 10000 ? 0.75 : 0.5,
                    });
                }
            }
        }
    }

    if (flaggedPaths.length > 0) {
        graphLog(`[GRAPH] ${flaggedPaths.length}-node fraud chain(s) identified`);
    }

    // Deduplicate and sort by risk
    const unique = Array.from(
        new Map(flaggedPaths.map(p => [p.path.join("→"), p])).values()
    ).sort((a, b) => b.risk_score - a.risk_score);

    return unique.slice(0, 20); // Top 20 paths
}
