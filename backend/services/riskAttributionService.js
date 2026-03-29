/**
 * Risk Attribution Engine
 * Combines ML risk scores, rule-based signals, and graph backtracking
 * to produce explainable risk assessments
 * 
 * Output format:
 * {
 *   risk_score,
 *   risk_level,
 *   typologies: ["smurfing", "cross-border"],  
 *   rule_signals: [...],
 *   flagged_chains: [{ path, reason }],
 *   ml_contribution: {...},
 *   backend_contribution: {...}
 * }
 */

const riskLog = (message, data = null) => {
    console.log(`[RISK][${new Date().toISOString()}] ${message}`, data ? JSON.stringify(data).slice(0, 300) : "");
};

// ─── Rule-Based Risk Signals ─────────────────────────────────────────────────

const RULE_DEFINITIONS = {
    smurfing: {
        name: "Structuring / Smurfing",
        description: "Multiple sub-threshold transactions to evade CTR filing",
        check: (transactions) => {
            const subThreshold = transactions.filter(t => {
                const amount = parseFloat(t.amount);
                return amount >= 8000 && amount <= 10000;
            });
            return subThreshold.length >= 3;
        },
        details: (transactions) => {
            const subThreshold = transactions.filter(t => {
                const amount = parseFloat(t.amount);
                return amount >= 8000 && amount <= 10000;
            });
            return `${subThreshold.length} transactions in $8,000-$10,000 range detected (CTR evasion pattern)`;
        },
        severity: "critical",
    },

    rapid_movement: {
        name: "Rapid Fund Movement",
        description: "Funds moved through multiple accounts within 24h",
        check: (transactions) => {
            const sorted = [...transactions]
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            for (let i = 1; i < sorted.length; i++) {
                const diff = new Date(sorted[i].timestamp) - new Date(sorted[i - 1].timestamp);
                if (diff < 86400000 && parseFloat(sorted[i].amount) > 5000) { // 24h
                    return true;
                }
            }
            return false;
        },
        details: (transactions) => {
            const sorted = [...transactions]
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            let rapidCount = 0;
            for (let i = 1; i < sorted.length; i++) {
                const diff = new Date(sorted[i].timestamp) - new Date(sorted[i - 1].timestamp);
                if (diff < 86400000 && parseFloat(sorted[i].amount) > 5000) rapidCount++;
            }
            return `${rapidCount} rapid high-value transfers detected within 24h windows`;
        },
        severity: "high",
    },

    circular_transactions: {
        name: "Circular Transaction Pattern",
        description: "Funds returning to originating account through intermediaries",
        check: (transactions) => {
            const senders = new Set();
            const receivers = new Set();
            transactions.forEach(t => {
                const senderId = t.senderDetails?.acc_id || t.senderDetails?.account_id;
                const receiverId = t.receiverDetails?.acc_id || t.receiverDetails?.account_id;
                if (senderId) senders.add(senderId);
                if (receiverId) receivers.add(receiverId);
            });
            // Check for accounts appearing as both sender and receiver
            const overlap = [...senders].filter(s => receivers.has(s));
            return overlap.length >= 2;
        },
        details: (transactions) => {
            const senders = new Set();
            const receivers = new Set();
            transactions.forEach(t => {
                const senderId = t.senderDetails?.acc_id || t.senderDetails?.account_id;
                const receiverId = t.receiverDetails?.acc_id || t.receiverDetails?.account_id;
                if (senderId) senders.add(senderId);
                if (receiverId) receivers.add(receiverId);
            });
            const overlap = [...senders].filter(s => receivers.has(s));
            return `${overlap.length} accounts appear as both sender and receiver — potential circular flow`;
        },
        severity: "critical",
    },

    cross_border_anomaly: {
        name: "Cross-Border Anomaly",
        description: "Suspicious cross-border transaction pattern",
        check: (transactions) => {
            const countries = new Set();
            transactions.forEach(t => {
                const sCountry = t.senderDetails?.country;
                const rCountry = t.receiverDetails?.country;
                if (sCountry) countries.add(sCountry);
                if (rCountry) countries.add(rCountry);
            });
            return countries.size >= 3;
        },
        details: (transactions) => {
            const countries = new Set();
            transactions.forEach(t => {
                const sCountry = t.senderDetails?.country;
                const rCountry = t.receiverDetails?.country;
                if (sCountry) countries.add(sCountry);
                if (rCountry) countries.add(rCountry);
            });
            return `Transactions span ${countries.size} jurisdictions: ${[...countries].join(", ")}`;
        },
        severity: "high",
    },

    high_value_concentration: {
        name: "High-Value Concentration",
        description: "Disproportionate transaction amounts in short period",
        check: (transactions) => {
            const totalAmount = transactions.reduce((s, t) => s + parseFloat(t.amount || 0), 0);
            return totalAmount > 100000;
        },
        details: (transactions) => {
            const totalAmount = transactions.reduce((s, t) => s + parseFloat(t.amount || 0), 0);
            return `Total transaction volume: $${totalAmount.toLocaleString()} exceeds $100,000 threshold`;
        },
        severity: "high",
    },

    round_amount_pattern: {
        name: "Round Amount Pattern",
        description: "Multiple transactions with suspiciously round amounts",
        check: (transactions) => {
            const roundTxns = transactions.filter(t => {
                const amount = parseFloat(t.amount);
                return amount >= 1000 && amount % 1000 === 0;
            });
            return roundTxns.length >= 3;
        },
        details: (transactions) => {
            const roundTxns = transactions.filter(t => {
                const amount = parseFloat(t.amount);
                return amount >= 1000 && amount % 1000 === 0;
            });
            return `${roundTxns.length} transactions with round amounts detected`;
        },
        severity: "medium",
    },
};

// ─── Main Attribution Engine ─────────────────────────────────────────────────

/**
 * Generate complete risk attribution for a case
 * 
 * @param {Object} caseData - Full case with transactions
 * @param {Object} mlInsights - ML analysis results
 * @param {Object} graphData - Fraud graph output
 * @returns {Object} - Complete risk attribution
 */
export function generateRiskAttribution(caseData, mlInsights = {}, graphData = {}) {
    riskLog(`Generating risk attribution for case ${caseData.displayId || caseData.id}`);

    const transactions = caseData.transactions || [];

    // ─── 1. ML Risk Contribution ────────────────────────────────────────────

    const mlRiskScore = parseFloat(mlInsights?.risk_score) || 0;
    const mlPatterns = mlInsights?.patterns || [];
    const mlAlerts = mlInsights?.alerts || [];

    const mlContribution = {
        source: "ML_ENGINE",
        risk_score: mlRiskScore,
        patterns: mlPatterns,
        alerts: mlAlerts.map(a => ({
            type: a.type || a,
            explanation: a.explanation || a.description || String(a),
        })),
        weight: 0.5, // ML contributes 50% of final score
    };

    // ─── 2. Rule-Based Risk Signals ─────────────────────────────────────────

    const ruleSignals = [];
    const detectedTypologies = [];
    let ruleScore = 0;

    for (const [ruleId, rule] of Object.entries(RULE_DEFINITIONS)) {
        if (rule.check(transactions)) {
            const signal = {
                rule_id: ruleId,
                name: rule.name,
                description: rule.description,
                severity: rule.severity,
                details: rule.details(transactions),
                triggered: true,
            };
            ruleSignals.push(signal);
            detectedTypologies.push(ruleId);

            // Severity-based scoring
            const severityScore = { critical: 30, high: 20, medium: 10, low: 5 };
            ruleScore += severityScore[rule.severity] || 5;

            riskLog(`[RISK] ${rule.name} pattern detected`);
        }
    }

    // Normalize rule score to 0-1
    const normalizedRuleScore = Math.min(1, ruleScore / 100);
    const ruleContribution = {
        source: "RULE_ENGINE",
        risk_score: normalizedRuleScore,
        signals: ruleSignals,
        typologies: detectedTypologies,
        weight: 0.3, // Rules contribute 30% of final score
    };

    // ─── 3. Graph-Based Risk ────────────────────────────────────────────────

    const graphPaths = graphData?.flagged_paths || [];
    const graphClusters = graphData?.clusters || [];
    const graphRiskScore = calculateGraphRisk(graphPaths, graphClusters);

    const graphContribution = {
        source: "GRAPH_ENGINE",
        risk_score: graphRiskScore,
        flagged_chains: graphPaths.slice(0, 10), // Top 10
        clusters: graphClusters,
        weight: 0.2, // Graph contributes 20% of final score
    };

    // ─── 4. Composite Risk Score ────────────────────────────────────────────

    const compositeScore = (
        mlContribution.risk_score * mlContribution.weight +
        ruleContribution.risk_score * ruleContribution.weight +
        graphContribution.risk_score * graphContribution.weight
    );

    // Ensure minimum score if any critical signals exist
    const hasCritical = ruleSignals.some(s => s.severity === "critical");
    const finalScore = hasCritical ? Math.max(compositeScore, 0.7) : compositeScore;
    const finalLevel = scoreToLevel(finalScore);

    riskLog(`Risk attribution complete: score=${finalScore.toFixed(3)}, level=${finalLevel}, typologies=${detectedTypologies.join(",")}`);

    return {
        risk_score: Math.round(finalScore * 100) / 100,
        risk_level: finalLevel,
        typologies: detectedTypologies,
        rule_signals: ruleSignals,
        flagged_chains: graphPaths.slice(0, 10),
        ml_contribution: mlContribution,
        rule_contribution: ruleContribution,
        graph_contribution: graphContribution,
        composite_breakdown: {
            ml_weighted: Math.round(mlContribution.risk_score * mlContribution.weight * 100) / 100,
            rules_weighted: Math.round(ruleContribution.risk_score * ruleContribution.weight * 100) / 100,
            graph_weighted: Math.round(graphContribution.risk_score * graphContribution.weight * 100) / 100,
        },
        explainability: {
            what_csv_provides: "Raw transactional data (amounts, accounts, timestamps, countries)",
            what_ml_provides: `Risk score (${mlRiskScore}), ${mlPatterns.length} patterns, ${mlAlerts.length} alerts`,
            what_backend_derives: `${ruleSignals.length} rule-based signals, ${graphPaths.length} graph paths, ${graphClusters.length} clusters`,
            how_risk_calculated: `Composite: ML(${(mlContribution.weight * 100)}%) + Rules(${(ruleContribution.weight * 100)}%) + Graph(${(graphContribution.weight * 100)}%)`,
            how_sar_generated: "ML narrative enhanced with rule-based evidence and graph backtracking",
        },
    };
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function calculateGraphRisk(flaggedPaths, clusters) {
    let score = 0;
    // Each flagged path adds risk
    score += Math.min(0.4, flaggedPaths.length * 0.1);
    // Each cluster adds risk
    score += Math.min(0.3, clusters.length * 0.1);
    // High-risk clusters contribute more
    const highRiskClusters = clusters.filter(c => c.risk_indicator === "high");
    score += highRiskClusters.length * 0.15;

    return Math.min(1, score);
}

function scoreToLevel(score) {
    if (score >= 0.85) return "CRITICAL";
    if (score >= 0.65) return "HIGH";
    if (score >= 0.4) return "MEDIUM";
    return "LOW";
}
