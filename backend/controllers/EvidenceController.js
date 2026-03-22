import { db } from "../middlewares/dbconfig.js";
import { cases, auditLogs, evidence } from "../src/db/schemas.ts";
import { eq } from "drizzle-orm";
export const extractEvidence = async (req, res) => {
    const { id } = req.params;

    try {
        const targetCase = await db.query.cases.findFirst({
            where: eq(cases.id, id),
            with: { transactions: true }
        });

        if (!targetCase || !targetCase.mlInsights) {
            return res.status(400).json({ message: "Case analysis not found" });
        }

        const { graph_patterns, alerts } = targetCase.mlInsights;

        // --- NEW VALIDATION: FILTER ZERO-NODE PATTERNS ---
        // We only care about patterns that actually have connected accounts/nodes
        const activePatterns = graph_patterns?.filter(pattern =>
            pattern.nodes && pattern.nodes.length > 0
        ) || [];

        await db.transaction(async (tx) => {

            // 1. Only insert NETWORK_CHAIN if there are actual connections
            if (activePatterns.length > 0) {
                await tx.insert(evidence).values({
                    caseId: id,
                    evidenceType: "NETWORK_CHAIN",
                    description: `Detected suspicious flow across ${activePatterns.length} connected entity nodes.`,
                    linkedTxIds: targetCase.transactions.map(t => t.id)
                });
            } else {
                // Optional: Log that no network was found for audit purposes
                console.log(`Case ${id}: No connected nodes found, skipping Graph Evidence.`);
            }

            // 2. Insert Typology Evidence (Standard AML Alerts)
            for (const alert of alerts) {
                await tx.insert(evidence).values({
                    caseId: id,
                    evidenceType: alert.type,
                    description: alert.explanation,
                });
            }

            // 3. Status Shift & Audit
            await tx.update(cases)
                .set({
                    status: "DRAFT", // Move to Draft for manual review
                    updatedAt: new Date()
                })
                .where(eq(cases.id, id));

            await tx.insert(auditLogs).values({
                caseId: id,
                action: "EVIDENCE_GENERATED",
                actor: "SYSTEM",
                details: activePatterns.length > 0
                    ? `Generated graph evidence with ${activePatterns.length} nodes.`
                    : "Generated typology evidence (No network detected)."
            });
        });

        return res.status(200).json({
            message: "Evidence extracted successfully",
            hasGraph: activePatterns.length > 0
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};