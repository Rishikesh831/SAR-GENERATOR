/**
 * Background Worker (REFACTORED)
 * Uses ML API for narrative generation when available, with template fallback
 */

import { Worker } from 'bullmq';
import { redisConnection } from './middlewares/redis.js';
import { db } from './middlewares/dbconfig.js';
import { cases, auditLogs } from './src/db/schemas.ts';
import { eq } from 'drizzle-orm';
import { getIO } from "./utils/socket.js";
import { callMLGenerateSAR } from './services/mlService.js';

const worker = new Worker('narrative-generation', async (job) => {
    const { caseId } = job.data;
    console.log(`[WORKER] Starting Narrative for Case: ${caseId}`);

    try {
        // 1. FETCH FULL CONTEXT
        const targetCase = await db.query.cases.findFirst({
            where: eq(cases.id, caseId),
            with: { transactions: true, evidence: true }
        });

        if (!targetCase) {
            throw new Error(`Case ${caseId} not found`);
        }

        let narrative;
        let narrativeSource = "TEMPLATE";

        // 2. ATTEMPT ML NARRATIVE GENERATION
        const existingNarrative = targetCase.mlInsights?.sar_narrative;
        if (existingNarrative && typeof existingNarrative === "string" && existingNarrative.length > 50) {
            // ML narrative already available from analysis phase
            narrative = existingNarrative;
            narrativeSource = "ML_CACHED";
            console.log(`[WORKER] Using cached ML narrative for ${caseId}`);
        } else {
            // Try calling ML API for narrative
            try {
                const mlResult = await callMLGenerateSAR(targetCase.transactions, targetCase.displayId || caseId);
                if (mlResult.success && mlResult.data?.sar_narrative) {
                    narrative = mlResult.data.sar_narrative;
                    narrativeSource = "ML_LIVE";
                    console.log(`[WORKER] ML narrative generated for ${caseId}`);
                }
            } catch (mlErr) {
                console.warn(`[WORKER] ML API failed, using template: ${mlErr.message}`);
            }
        }

        // 3. FALLBACK: Template-based narrative
        if (!narrative) {
            const riskAttribution = targetCase.mlInsights?.risk_attribution || {};
            const typologies = riskAttribution?.typologies || [];

            narrative = `
SAR REPORT — JURISDICTION: ${targetCase.jurisdiction || "Global"}
SUBJECT: ${targetCase.customerDetails?.name || "Unknown Entity"}

EXECUTIVE SUMMARY:
Activity detected involving ${targetCase.transactions.length} transaction(s).
The ML pipeline identified ${targetCase.evidence.length} specific red flag(s).
${typologies.length > 0 ? `Detected patterns: ${typologies.map(t => t.replace(/_/g, " ")).join(", ")}.` : ""}

SUSPICIOUS ACTIVITY PATTERN:
The subject was flagged for ${targetCase.evidence[0]?.evidenceType || "Suspicious Activity"}.
Analysis confirms patterns consistent with ${targetCase.jurisdiction || "Global"} AML typologies.
${riskAttribution.risk_score ? `Composite risk score: ${Math.round(riskAttribution.risk_score * 100)}%` : ""}

CONCLUSION:
Based on the evidence attached, this case is recommended for ${targetCase.jurisdiction || "regulatory"} filing.

Report Generated: ${new Date().toISOString()}
            `.trim();
            narrativeSource = "TEMPLATE";
        }

        // 4. SAVE TO DB
        await db.transaction(async (tx) => {
            await tx.update(cases)
                .set({
                    summaryLlm: narrative,
                    status: "IN_REVIEW",
                    pipelineStatus: {
                        ...(targetCase.pipelineStatus || {}),
                        narrative_gen: "completed",
                    },
                    updatedAt: new Date(),
                })
                .where(eq(cases.id, caseId));

            await tx.insert(auditLogs).values({
                caseId: caseId,
                action: "NARRATIVE_GENERATED",
                actor: "SYSTEM_WORKER",
                details: `Automated narrative generated via background worker (source: ${narrativeSource})`,
                payload: {
                    narrative_source: narrativeSource,
                    narrative_length: narrative.length,
                },
            });
        });

        // 5. PUSH TO FRONTEND (Real-time update)
        try {
            getIO().to(caseId).emit('narrative_ready', {
                caseId: caseId,
                status: 'COMPLETED',
                narrative: narrative,
                source: narrativeSource,
            });
        } catch (socketErr) {
            console.warn(`[WORKER] Socket push failed: ${socketErr.message}`);
        }

        console.log(`[WORKER] ✅ Successfully generated narrative for ${caseId} (source: ${narrativeSource})`);
        return { success: true, source: narrativeSource };

    } catch (error) {
        console.error(`[WORKER ERROR] Job ${job.id}:`, error);
        throw error; // Let BullMQ handle the exponential backoff
    }
}, { connection: redisConnection });