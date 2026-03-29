/**
 * Global Risk Controller (NEW)
 * GET /api/global-risks — Cross-case risk aggregation
 * 
 * Aggregates:
 * - Top typologies across all cases
 * - High-risk clusters
 * - Cross-case patterns
 */

import { db } from "../middlewares/dbconfig.js";
import { cases } from "../src/db/schemas.ts";
import { desc, sql } from "drizzle-orm";

export const getGlobalRisks = async (req, res) => {
    try {
        // Fetch all analyzed cases
        const allCases = await db.query.cases.findMany({
            with: { transactions: true },
            orderBy: [desc(cases.createdAt)],
        });

        const analyzedCases = allCases.filter(c => c.mlInsights);

        if (analyzedCases.length === 0) {
            return res.status(200).json({
                message: "No analyzed cases found",
                total_cases: allCases.length,
                analyzed_cases: 0,
                top_typologies: [],
                high_risk_clusters: [],
                cross_case_patterns: [],
                risk_distribution: {},
            });
        }

        // ─── Aggregate typologies ────────────────────────────────────────────

        const typologyCount = {};
        const riskDistribution = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
        const highRiskCases = [];
        const allClusters = [];
        const allTypologies = [];

        for (const c of analyzedCases) {
            const riskAttribution = c.mlInsights?.risk_attribution || {};
            const typologies = riskAttribution?.typologies || [];
            const riskLevel = c.riskLevel || "LOW";

            riskDistribution[riskLevel] = (riskDistribution[riskLevel] || 0) + 1;

            typologies.forEach(t => {
                typologyCount[t] = (typologyCount[t] || 0) + 1;
                allTypologies.push({ typology: t, caseId: c.displayId || c.id });
            });

            if (riskLevel === "CRITICAL" || riskLevel === "HIGH") {
                highRiskCases.push({
                    case_id: c.displayId || c.id,
                    risk_score: parseFloat(c.riskScore || 0),
                    risk_level: riskLevel,
                    typologies,
                    transaction_count: c.transactions?.length || 0,
                    status: c.status,
                });
            }

            const clusters = c.mlInsights?.clusters || [];
            clusters.forEach(cluster => {
                allClusters.push({
                    ...cluster,
                    source_case: c.displayId || c.id,
                });
            });
        }

        // Top typologies sorted by frequency
        const topTypologies = Object.entries(typologyCount)
            .sort(([, a], [, b]) => b - a)
            .map(([typology, count]) => ({
                typology,
                display_name: typology.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
                count,
                affected_cases: allTypologies.filter(t => t.typology === typology).map(t => t.caseId),
            }));

        // ─── Cross-case pattern detection ────────────────────────────────────

        const crossCasePatterns = [];

        // Check for entities appearing across multiple cases
        const entityCaseMap = new Map();
        for (const c of analyzedCases) {
            const txns = c.transactions || [];
            txns.forEach(t => {
                const senderId = t.senderDetails?.acc_id || t.senderDetails?.account_id;
                const receiverId = t.receiverDetails?.acc_id || t.receiverDetails?.account_id;

                [senderId, receiverId].filter(Boolean).forEach(entityId => {
                    if (!entityCaseMap.has(entityId)) entityCaseMap.set(entityId, new Set());
                    entityCaseMap.get(entityId).add(c.displayId || c.id);
                });
            });
        }

        // Find entities in multiple cases
        for (const [entityId, caseSet] of entityCaseMap) {
            if (caseSet.size >= 2) {
                crossCasePatterns.push({
                    type: "MULTI_CASE_ENTITY",
                    entity_id: entityId,
                    cases: [...caseSet],
                    case_count: caseSet.size,
                    risk_indicator: caseSet.size >= 3 ? "critical" : "high",
                    description: `Entity ${entityId} appears across ${caseSet.size} cases`,
                });
            }
        }

        // Summary statistics
        const totalAmount = analyzedCases.reduce((s, c) => {
            const caseTxnTotal = (c.transactions || []).reduce((ts, t) => ts + parseFloat(t.amount || 0), 0);
            return s + caseTxnTotal;
        }, 0);

        return res.status(200).json({
            message: "Global risk aggregation generated",
            total_cases: allCases.length,
            analyzed_cases: analyzedCases.length,
            risk_distribution: riskDistribution,
            total_amount_at_risk: Math.round(totalAmount),
            top_typologies: topTypologies,
            high_risk_cases: highRiskCases.sort((a, b) => b.risk_score - a.risk_score),
            high_risk_clusters: allClusters.filter(c => c.risk_indicator === "high"),
            cross_case_patterns: crossCasePatterns,
            generated_at: new Date().toISOString(),
        });

    } catch (error) {
        console.error("[GLOBAL-RISK] Error:", error.message);
        return res.status(500).json({ error: error.message });
    }
};
