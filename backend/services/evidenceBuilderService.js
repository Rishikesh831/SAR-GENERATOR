/**
 * Evidence Builder Service
 * Compiles forensic evidence from ML output, graph engine, and rule-based flags
 * 
 * Sources:
 * 1. ML output (patterns, alerts, anomalies)
 * 2. Graph engine (chains, clusters, flagged paths)
 * 3. Rule-based flags (typology matches)
 */

const evidenceLog = (message) => {
    console.log(`[EVIDENCE][${new Date().toISOString()}] ${message}`);
};

/**
 * Build comprehensive evidence package for a case
 * 
 * @param {Object} caseData - Full case with transactions
 * @param {Object} mlInsights - ML analysis results
 * @param {Object} graphData - Fraud graph output
 * @param {Object} riskAttribution - Risk attribution results
 * @returns {Object} - Evidence package
 */
export function buildEvidence(caseData, mlInsights = {}, graphData = {}, riskAttribution = {}) {
    evidenceLog(`Building evidence for case ${caseData.displayId || caseData.id}`);

    const transactions = caseData.transactions || [];
    const evidence = [];

    // ─── 1. Suspicious Transactions ──────────────────────────────────────────

    const suspiciousTxns = transactions.filter(t => t.isFlagged);
    const highValueTxns = transactions.filter(t => parseFloat(t.amount) > 10000);

    if (suspiciousTxns.length > 0) {
        evidence.push({
            type: "SUSPICIOUS_TRANSACTIONS",
            category: "primary",
            source: "CSV_DATA",
            title: "Flagged Transactions",
            description: `${suspiciousTxns.length} transaction(s) were flagged as suspicious during ingestion`,
            details: suspiciousTxns.map(t => ({
                id: t.displayId || t.id,
                amount: parseFloat(t.amount),
                currency: t.currency,
                timestamp: t.timestamp,
                sender: t.senderDetails?.name || t.senderDetails?.acc_id || "Unknown",
                receiver: t.receiverDetails?.name || t.receiverDetails?.acc_id || "Unknown",
            })),
            confidence: 90,
        });
    }

    if (highValueTxns.length > 0) {
        evidence.push({
            type: "HIGH_VALUE_TRANSACTIONS",
            category: "primary",
            source: "CSV_DATA",
            title: "High-Value Transactions",
            description: `${highValueTxns.length} transaction(s) exceed $10,000 CTR threshold`,
            details: highValueTxns.map(t => ({
                id: t.displayId || t.id,
                amount: parseFloat(t.amount),
                currency: t.currency,
            })),
            confidence: 85,
        });
    }

    // ─── 2. ML-Detected Patterns ─────────────────────────────────────────────

    const mlPatterns = mlInsights?.patterns || [];
    const mlAlerts = mlInsights?.alerts || [];

    if (mlPatterns.length > 0) {
        evidence.push({
            type: "ML_PATTERN_DETECTION",
            category: "ml_derived",
            source: "ML_ENGINE",
            title: "ML-Detected Suspicious Patterns",
            description: `Machine learning identified ${mlPatterns.length} suspicious pattern(s)`,
            details: mlPatterns.map(p => typeof p === "string" ? { pattern: p } : p),
            confidence: Math.round((mlInsights?.risk_score || 0.5) * 100),
        });
    }

    for (const alert of mlAlerts) {
        evidence.push({
            type: alert.type || "ML_ALERT",
            category: "ml_derived",
            source: "ML_ENGINE",
            title: `ML Alert: ${(alert.type || "Anomaly").replace(/_/g, " ")}`,
            description: alert.explanation || alert.description || String(alert),
            confidence: alert.confidence || 80,
        });
    }

    // ML evidence bundle (from ML API)
    const mlEvidenceBundle = mlInsights?.evidence_bundle;
    if (mlEvidenceBundle && Array.isArray(mlEvidenceBundle)) {
        for (const item of mlEvidenceBundle) {
            evidence.push({
                type: item.type || "ML_FORENSIC",
                category: "ml_derived",
                source: "ML_ENGINE",
                title: item.title || "ML Forensic Evidence",
                description: item.description || JSON.stringify(item),
                confidence: item.confidence || 75,
            });
        }
    }

    // ─── 3. Graph-Based Evidence ─────────────────────────────────────────────

    const flaggedPaths = graphData?.flagged_paths || [];
    const clusters = graphData?.clusters || [];

    if (flaggedPaths.length > 0) {
        evidence.push({
            type: "NETWORK_CHAIN",
            category: "graph_derived",
            source: "GRAPH_ENGINE",
            title: "Suspicious Fund Flow Chains",
            description: `Graph analysis identified ${flaggedPaths.length} suspicious fund flow path(s)`,
            details: flaggedPaths.map(p => ({
                path: p.path,
                reason: p.reason,
                total_amount: p.total_amount,
                risk_score: p.risk_score,
            })),
            confidence: 85,
        });
    }

    if (clusters.length > 0) {
        evidence.push({
            type: "ENTITY_CLUSTER",
            category: "graph_derived",
            source: "GRAPH_ENGINE",
            title: "Connected Entity Clusters",
            description: `${clusters.length} cluster(s) of connected entities identified`,
            details: clusters.map(c => ({
                cluster_id: c.id,
                members: c.members,
                size: c.size,
                risk_indicator: c.risk_indicator,
            })),
            confidence: 80,
        });
    }

    // ─── 4. Rule-Based Evidence ──────────────────────────────────────────────

    const ruleSignals = riskAttribution?.rule_signals || [];
    for (const signal of ruleSignals) {
        if (signal.triggered) {
            evidence.push({
                type: `RULE_${signal.rule_id.toUpperCase()}`,
                category: "rule_derived",
                source: "RULE_ENGINE",
                title: signal.name,
                description: signal.details,
                confidence: signal.severity === "critical" ? 95 : signal.severity === "high" ? 85 : 70,
            });
        }
    }

    // ─── 5. Anomaly Summaries ────────────────────────────────────────────────

    const totalAmount = transactions.reduce((s, t) => s + parseFloat(t.amount || 0), 0);
    const avgAmount = transactions.length > 0 ? totalAmount / transactions.length : 0;
    const countries = new Set();
    transactions.forEach(t => {
        if (t.senderDetails?.country) countries.add(t.senderDetails.country);
        if (t.receiverDetails?.country) countries.add(t.receiverDetails.country);
    });

    evidence.push({
        type: "TRANSACTION_SUMMARY",
        category: "statistical",
        source: "BACKEND",
        title: "Transaction Statistical Summary",
        description: `${transactions.length} transactions totalling $${totalAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })} across ${countries.size} jurisdiction(s)`,
        details: {
            total_transactions: transactions.length,
            total_amount: Math.round(totalAmount),
            average_amount: Math.round(avgAmount),
            max_amount: Math.round(Math.max(...transactions.map(t => parseFloat(t.amount || 0)))),
            min_amount: Math.round(Math.min(...transactions.map(t => parseFloat(t.amount || 0)))),
            jurisdictions: [...countries],
            flagged_count: suspiciousTxns.length,
        },
        confidence: 100,
    });

    // ─── 6. Linked Entities ──────────────────────────────────────────────────

    const linkedEntities = new Map();
    transactions.forEach(t => {
        const senderId = t.senderDetails?.acc_id || t.senderDetails?.account_id;
        const receiverId = t.receiverDetails?.acc_id || t.receiverDetails?.account_id;
        if (senderId) {
            if (!linkedEntities.has(senderId)) linkedEntities.set(senderId, { roles: new Set(), txnCount: 0, totalAmount: 0 });
            linkedEntities.get(senderId).roles.add("sender");
            linkedEntities.get(senderId).txnCount++;
            linkedEntities.get(senderId).totalAmount += parseFloat(t.amount || 0);
        }
        if (receiverId) {
            if (!linkedEntities.has(receiverId)) linkedEntities.set(receiverId, { roles: new Set(), txnCount: 0, totalAmount: 0 });
            linkedEntities.get(receiverId).roles.add("receiver");
            linkedEntities.get(receiverId).txnCount++;
            linkedEntities.get(receiverId).totalAmount += parseFloat(t.amount || 0);
        }
    });

    if (linkedEntities.size > 0) {
        evidence.push({
            type: "LINKED_ENTITIES",
            category: "entity_analysis",
            source: "BACKEND",
            title: "Linked Entity Analysis",
            description: `${linkedEntities.size} unique account(s) involved in case transactions`,
            details: Array.from(linkedEntities.entries()).map(([id, info]) => ({
                entity_id: id,
                roles: [...info.roles],
                transaction_count: info.txnCount,
                total_amount: Math.round(info.totalAmount),
            })),
            confidence: 95,
        });
    }

    evidenceLog(`Evidence built: ${evidence.length} items (${evidence.filter(e => e.source === "ML_ENGINE").length} ML, ${evidence.filter(e => e.source === "GRAPH_ENGINE").length} graph, ${evidence.filter(e => e.source === "RULE_ENGINE").length} rule, ${evidence.filter(e => e.source === "BACKEND" || e.source === "CSV_DATA").length} backend)`);

    return {
        evidence,
        summary: {
            total_items: evidence.length,
            by_source: {
                csv_data: evidence.filter(e => e.source === "CSV_DATA").length,
                ml_engine: evidence.filter(e => e.source === "ML_ENGINE").length,
                graph_engine: evidence.filter(e => e.source === "GRAPH_ENGINE").length,
                rule_engine: evidence.filter(e => e.source === "RULE_ENGINE").length,
                backend: evidence.filter(e => e.source === "BACKEND").length,
            },
            by_category: {
                primary: evidence.filter(e => e.category === "primary").length,
                ml_derived: evidence.filter(e => e.category === "ml_derived").length,
                graph_derived: evidence.filter(e => e.category === "graph_derived").length,
                rule_derived: evidence.filter(e => e.category === "rule_derived").length,
                statistical: evidence.filter(e => e.category === "statistical").length,
                entity_analysis: evidence.filter(e => e.category === "entity_analysis").length,
            },
            avg_confidence: evidence.length > 0
                ? Math.round(evidence.reduce((s, e) => s + (e.confidence || 0), 0) / evidence.length)
                : 0,
        },
    };
}
