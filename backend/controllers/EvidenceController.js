/**
 * Evidence Controller (REFACTORED)
 * Now uses ML output + graph engine + rule-based flags
 * Backward compatible: same endpoint, enhanced output
 */

import { db } from "../middlewares/dbconfig.js";
import { cases, auditLogs, evidence } from "../src/db/schemas.ts";
import { eq } from "drizzle-orm";
import { buildFraudGraph } from "../services/fraudGraphService.js";
import { generateRiskAttribution } from "../services/riskAttributionService.js";
import { buildEvidence } from "../services/evidenceBuilderService.js";

export const extractEvidence = async (req, res) => {
    const { id } = req.params;

    try {
        const targetCase = await db.query.cases.findFirst({
            where: eq(cases.id, id),
            with: { transactions: true }
        });

        if (!targetCase) {
            return res.status(404).json({ message: "Case not found" });
        }

        if (!targetCase.mlInsights) {
            return res.status(400).json({ message: "Case analysis not found — run analysis first" });
        }

        console.log(`[EVIDENCE] Building evidence for case ${targetCase.displayId || id}`);

        // Build fraud graph from transactions
        const graphData = buildFraudGraph(
            targetCase.transactions,
            targetCase.customerDetails,
            targetCase.mlInsights
        );

        // Generate risk attribution
        const riskAttribution = generateRiskAttribution(
            targetCase,
            targetCase.mlInsights,
            graphData
        );

        // Build comprehensive evidence package
        const evidencePackage = buildEvidence(
            targetCase,
            targetCase.mlInsights,
            graphData,
            riskAttribution
        );

        // Store evidence in database
        await db.transaction(async (tx) => {
            // Insert each evidence item
            for (const item of evidencePackage.evidence) {
                await tx.insert(evidence).values({
                    caseId: id,
                    evidenceType: item.type,
                    description: item.description,
                    linkedTxIds: targetCase.transactions.map(t => t.displayId || t.id),
                });
            }

            // Update case status
            await tx.update(cases)
                .set({
                    status: "DRAFT",
                    updatedAt: new Date(),
                })
                .where(eq(cases.id, id));

            // Audit log
            await tx.insert(auditLogs).values({
                caseId: id,
                action: "EVIDENCE_GENERATED",
                actor: "SYSTEM",
                details: `Evidence extracted: ${evidencePackage.summary.total_items} items (${evidencePackage.summary.by_source.ml_engine} ML, ${evidencePackage.summary.by_source.graph_engine} graph, ${evidencePackage.summary.by_source.rule_engine} rule-based)`,
                payload: evidencePackage.summary,
            });
        });

        return res.status(200).json({
            message: "Evidence extracted successfully",
            hasGraph: graphData.flagged_paths.length > 0,
            evidenceCount: evidencePackage.summary.total_items,
            summary: evidencePackage.summary,
            evidence: evidencePackage.evidence,
            graphData: {
                nodes: graphData.nodes.length,
                edges: graphData.edges.length,
                clusters: graphData.clusters.length,
                flagged_paths: graphData.flagged_paths.length,
            },
            riskAttribution: {
                risk_score: riskAttribution.risk_score,
                risk_level: riskAttribution.risk_level,
                typologies: riskAttribution.typologies,
            },
        });

    } catch (error) {
        console.error("[EVIDENCE] Error:", error.message);
        return res.status(500).json({ error: error.message });
    }
};