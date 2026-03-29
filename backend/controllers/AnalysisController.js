/**
 * Analysis Controller (REFACTORED)
 * Now integrates with real ML API instead of mock data
 * 
 * Flow:
 * 1. Fetch case + transactions
 * 2. Send to ML API via mlService
 * 3. Build fraud graph
 * 4. Generate risk attribution
 * 5. Store all results
 * 6. Audit log
 */

import { db } from "../middlewares/dbconfig.js";
import { cases, auditLogs } from "../src/db/schemas.ts";
import { eq } from "drizzle-orm";
import { callMLGenerateSAR, transformFromML } from "../services/mlService.js";
import { buildFraudGraph } from "../services/fraudGraphService.js";
import { generateRiskAttribution } from "../services/riskAttributionService.js";

export const analyzeCase = async (req, res) => {
    const { id } = req.params;

    try {
        // 1. PRE-CHECK
        const targetCase = await db.query.cases.findFirst({
            where: eq(cases.id, id),
            with: { transactions: true }
        });

        if (!targetCase) {
            return res.status(404).json({ message: "Case not found" });
        }

        if (targetCase.status === 'COMPLETED' || targetCase.status === 'FILED') {
            return res.status(400).json({ message: "Analysis already completed for this case" });
        }

        console.log(`[ML] Sending data for case ${targetCase.displayId || id}`);

        // 2. UPDATE STATUS — ANALYZING
        await db.update(cases)
            .set({ status: "ANALYZING" })
            .where(eq(cases.id, id));

        // 3. CALL ML API (real integration)
        let mlResult;
        try {
            mlResult = await callMLGenerateSAR(
                targetCase.transactions,
                targetCase.displayId || id
            );
        } catch (mlError) {
            console.warn(`[ML] ML API call failed, using rule-based fallback: ${mlError.message}`);
            mlResult = { success: false, data: null, error: mlError.message };
        }

        // If ML fails, use rule-based fallback (preserve existing behavior)
        let mlInsights;
        if (mlResult.success && mlResult.data) {
            mlInsights = mlResult.data;
            console.log(`[ML] Response received (risk_score=${mlInsights.risk_score})`);
        } else {
            console.warn("[ML] Falling back to rule-based analysis");
            mlInsights = generateFallbackMLInsights(targetCase.transactions);
        }

        // 4. BUILD FRAUD GRAPH
        const graphData = buildFraudGraph(
            targetCase.transactions,
            targetCase.customerDetails,
            mlInsights
        );

        // 5. GENERATE RISK ATTRIBUTION
        const riskAttribution = generateRiskAttribution(
            targetCase,
            mlInsights,
            graphData
        );

        // 6. UPDATE DATABASE
        const violatedLaws = mapTypologiesToLaws(riskAttribution.typologies);

        const [updatedCase] = await db.update(cases)
            .set({
                status: 'FLAGGED',
                riskScore: String(riskAttribution.risk_score),
                riskLevel: riskAttribution.risk_level,
                mlInsights: {
                    ...mlInsights,
                    graph_patterns: graphData.flagged_paths || [],
                    alerts: mlInsights.alerts || [],
                    clusters: graphData.clusters || [],
                    risk_attribution: riskAttribution,
                },
                violatedLaws,
                pipelineStatus: {
                    ingestion: "completed",
                    enrichment: "completed",
                    ml_analysis: mlResult.success ? "completed" : "fallback",
                    narrative_gen: "pending"
                },
                updatedAt: new Date(),
            })
            .where(eq(cases.id, id))
            .returning();

        // 7. AUDIT LOG
        await db.insert(auditLogs).values({
            caseId: id,
            action: "ML_ANALYSIS_COMPLETED",
            actor: "SYSTEM",
            payload: {
                risk_score: riskAttribution.risk_score,
                risk_level: riskAttribution.risk_level,
                ml_success: mlResult.success,
                typologies: riskAttribution.typologies,
                graph_nodes: graphData.stats?.total_nodes || 0,
                graph_edges: graphData.stats?.total_edges || 0,
                flagged_paths: graphData.flagged_paths?.length || 0,
            },
            details: `Analysis completed: risk=${riskAttribution.risk_score} (${riskAttribution.risk_level}), ${riskAttribution.typologies.length} typologies, ML=${mlResult.success ? "real" : "fallback"}`
        });

        console.log(`[SAR] Analysis complete for ${targetCase.displayId}: score=${riskAttribution.risk_score}, level=${riskAttribution.risk_level}`);

        return res.status(200).json({
            message: "Analysis Completed",
            riskScore: updatedCase.riskScore,
            riskLevel: updatedCase.riskLevel,
            status: updatedCase.status,
            mlSuccess: mlResult.success,
            typologies: riskAttribution.typologies,
            graphStats: graphData.stats,
        });

    } catch (error) {
        console.error("Analysis Error:", error.message);
        
        // Revert status on failure
        try {
            await db.update(cases)
                .set({ status: "INGESTED" })
                .where(eq(cases.id, id));
        } catch (_) { /* ignore revert errors */ }

        return res.status(500).json({ error: "Analysis pipeline failed", details: error.message });
    }
};

// ─── Fallback ML Insights (preserves existing behavior when ML is down) ──────

function generateFallbackMLInsights(transactions) {
    const suspiciousCount = transactions.filter(t => t.isFlagged).length;
    const totalAmount = transactions.reduce((s, t) => s + parseFloat(t.amount || 0), 0);

    return {
        risk_score: suspiciousCount > 0 ? 0.75 : totalAmount > 50000 ? 0.6 : 0.3,
        risk_level: suspiciousCount > 0 ? "HIGH" : totalAmount > 50000 ? "MEDIUM" : "LOW",
        patterns: [],
        alerts: suspiciousCount > 0 ? [
            { type: "FLAGGED_TRANSACTIONS", explanation: `${suspiciousCount} pre-flagged transactions detected` }
        ] : [],
        graph_patterns: [],
        clusters: [],
        sar_narrative: null,
        evidence_bundle: [],
        _source: "RULE_FALLBACK",
    };
}

function mapTypologiesToLaws(typologies) {
    const lawMap = {
        smurfing: "BSA 31 CFR §5324 (Structuring)",
        circular_transactions: "PMLA Section 3",
        cross_border_anomaly: "FATF R-20 (Cross-Border Reporting)",
        rapid_movement: "31 USC §5318(g) (Suspicious Activity)",
        high_value_concentration: "FinCEN SAR Filing Rule",
        round_amount_pattern: "BSA CTR Threshold",
    };

    return typologies.map(t => lawMap[t] || `AML Regulation (${t})`);
}