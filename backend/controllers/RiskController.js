/**
 * Risk Controller (NEW)
 * GET /api/cases/:id/risk — Risk attribution endpoint
 * 
 * Returns:
 * {
 *   risk_score,
 *   typologies,
 *   flagged_chains,
 *   ml_contribution,
 *   rule_contribution,
 *   graph_contribution,
 *   explainability
 * }
 */

import { db } from "../middlewares/dbconfig.js";
import { cases } from "../src/db/schemas.ts";
import { eq } from "drizzle-orm";
import { buildFraudGraph } from "../services/fraudGraphService.js";
import { generateRiskAttribution } from "../services/riskAttributionService.js";

export const getRiskAttribution = async (req, res) => {
    const { id } = req.params;

    try {
        const targetCase = await db.query.cases.findFirst({
            where: eq(cases.id, id),
            with: { transactions: true }
        });

        if (!targetCase) {
            return res.status(404).json({ message: "Case not found" });
        }

        // If ML analysis hasn't run yet, return basic info
        if (!targetCase.mlInsights) {
            return res.status(200).json({
                message: "ML analysis not yet completed for this case",
                risk_score: parseFloat(targetCase.riskScore || 0),
                risk_level: targetCase.riskLevel || "LOW",
                typologies: [],
                flagged_chains: [],
                status: "PENDING_ANALYSIS",
            });
        }

        // Build fraud graph
        const graphData = buildFraudGraph(
            targetCase.transactions,
            targetCase.customerDetails,
            targetCase.mlInsights
        );

        // Generate full risk attribution
        const riskAttribution = generateRiskAttribution(
            targetCase,
            targetCase.mlInsights,
            graphData
        );

        return res.status(200).json({
            message: "Risk attribution generated",
            ...riskAttribution,
            graph: {
                nodes: graphData.nodes,
                edges: graphData.edges,
                clusters: graphData.clusters,
                flagged_paths: graphData.flagged_paths,
                stats: graphData.stats,
            },
        });

    } catch (error) {
        console.error("[RISK] Error:", error.message);
        return res.status(500).json({ error: error.message });
    }
};

/**
 * GET /api/cases/:id/analytics — Case analytics endpoint
 */
export const getCaseAnalytics = async (req, res) => {
    const { id } = req.params;

    try {
        const targetCase = await db.query.cases.findFirst({
            where: eq(cases.id, id),
            with: { transactions: true }
        });

        if (!targetCase) {
            return res.status(404).json({ message: "Case not found" });
        }

        // Dynamic import to avoid circular dependency
        const { generateAnalytics } = await import("../services/analyticsService.js");

        const graphData = targetCase.mlInsights
            ? buildFraudGraph(targetCase.transactions, targetCase.customerDetails, targetCase.mlInsights)
            : { flagged_paths: [], clusters: [] };

        const riskAttribution = targetCase.mlInsights
            ? generateRiskAttribution(targetCase, targetCase.mlInsights, graphData)
            : {};

        const analytics = generateAnalytics(targetCase, targetCase.mlInsights || {}, riskAttribution);

        return res.status(200).json({
            message: "Analytics generated",
            ...analytics,
        });

    } catch (error) {
        console.error("[ANALYTICS] Error:", error.message);
        return res.status(500).json({ error: error.message });
    }
};
