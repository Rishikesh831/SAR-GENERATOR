/**
 * Narrative Controller (REFACTORED)
 * Now uses ML-generated narrative when available, with fallback to template
 * 
 * Flow:
 * 1. Fetch case + evidence + transactions
 * 2. Check compliance gate (evidence_attached)
 * 3. Try ML narrative from cached mlInsights
 * 4. If no ML narrative, use enhanced template
 * 5. Queue via BullMQ
 * 6. Audit log
 */

import { db } from "../middlewares/dbconfig.js";
import { cases, auditLogs } from "../src/db/schemas.ts";
import { eq } from "drizzle-orm";
import { Queue } from 'bullmq';
import { redisConnection } from '../middlewares/redis.js';

let narrativeQueue;
try {
    narrativeQueue = new Queue('narrative-generation', { connection: redisConnection });
} catch (err) {
    console.warn("[NARRATIVE] Redis/BullMQ unavailable, narrative queueing disabled:", err.message);
    narrativeQueue = null;
}

export const generateNarrative = async (req, res) => {
    const { id } = req.params;

    try {
        // 1. Fetch case with all context
        const targetCase = await db.query.cases.findFirst({
            where: eq(cases.id, id),
            with: {
                transactions: true,
                evidence: true
            }
        });

        if (!targetCase) {
            return res.status(404).json({ message: "Case not found" });
        }

        // 2. COMPLIANCE GATE: Human must approve evidence first
        if (!targetCase.complianceChecklist?.evidence_attached) {
            return res.status(403).json({
                message: "Narrative blocked: Analyst must approve evidence first."
            });
        }

        // 3. Build narrative from ML insights or template
        const mlInsights = targetCase.mlInsights || {};
        const riskAttribution = mlInsights.risk_attribution || {};
        let narrative;

        // Prefer ML-generated narrative if available
        if (mlInsights.sar_narrative && typeof mlInsights.sar_narrative === "string" && mlInsights.sar_narrative.length > 50) {
            console.log("[SAR] Using ML-generated narrative");
            narrative = enhanceMLNarrative(mlInsights.sar_narrative, targetCase, riskAttribution);
        } else {
            console.log("[SAR] Generating template-based narrative");
            narrative = generateTemplateNarrative(targetCase, mlInsights, riskAttribution);
        }

        // 4. Queue background processing if Redis available
        let jobId = null;
        if (narrativeQueue) {
            try {
                const job = await narrativeQueue.add('generate-sar',
                    { caseId: id },
                    {
                        attempts: 3,
                        backoff: { type: 'exponential', delay: 1000 },
                        removeOnComplete: true,
                    }
                );
                jobId = job.id;
            } catch (queueErr) {
                console.warn("[NARRATIVE] Queue failed, processing synchronously:", queueErr.message);
            }
        }

        // 5. SAVE & AUDIT
        await db.transaction(async (tx) => {
            await tx.update(cases)
                .set({
                    summaryLlm: narrative,
                    status: jobId ? "IN_QUEUE" : "IN_REVIEW",
                    pipelineStatus: {
                        ...(targetCase.pipelineStatus || {}),
                        narrative_gen: "completed",
                    },
                    updatedAt: new Date(),
                })
                .where(eq(cases.id, id));

            await tx.insert(auditLogs).values({
                caseId: id,
                action: jobId ? "PUSHED_TO_QUEUE" : "NARRATIVE_GENERATED",
                actor: "SYSTEM",
                payload: {
                    narrative_source: mlInsights.sar_narrative ? "ML_ENHANCED" : "TEMPLATE",
                    narrative_length: narrative.length,
                    queued: !!jobId,
                },
                details: `SAR narrative generated (${mlInsights.sar_narrative ? "ML-enhanced" : "template-based"}, ${narrative.length} chars)${jobId ? ` — Queued as job ${jobId}` : ""}`,
            });
        });

        console.log(`[SAR] Narrative generated successfully for case ${targetCase.displayId || id}`);

        return res.status(jobId ? 202 : 200).json({
            message: jobId ? "Narrative generation queued" : "Narrative generated",
            jobId: jobId || null,
            narrative,
        });

    } catch (error) {
        console.error("[NARRATIVE] Error:", error.message);
        return res.status(500).json({ error: error.message });
    }
};

// ─── Narrative Generators ────────────────────────────────────────────────────

function enhanceMLNarrative(mlNarrative, caseData, riskAttribution) {
    const typologies = riskAttribution?.typologies || [];
    const ruleSignals = riskAttribution?.rule_signals || [];

    let enhanced = `SAR REPORT — ${caseData.jurisdiction || "Global"}\n`;
    enhanced += `Case ID: ${caseData.displayId || caseData.id}\n`;
    enhanced += `Subject: ${caseData.customerDetails?.name || "Unknown"}\n`;
    enhanced += `Risk Level: ${riskAttribution?.risk_level || caseData.riskLevel || "N/A"}\n`;
    enhanced += `Generated: ${new Date().toISOString()}\n\n`;
    enhanced += `═══════════════════════════════════════════\n\n`;
    enhanced += `ML-GENERATED NARRATIVE:\n${mlNarrative}\n\n`;

    if (typologies.length > 0) {
        enhanced += `═══════════════════════════════════════════\n`;
        enhanced += `DETECTED TYPOLOGIES:\n`;
        typologies.forEach(t => {
            enhanced += `  • ${t.replace(/_/g, " ").toUpperCase()}\n`;
        });
        enhanced += `\n`;
    }

    if (ruleSignals.length > 0) {
        enhanced += `RULE-BASED SIGNALS:\n`;
        ruleSignals.forEach(s => {
            enhanced += `  [${s.severity.toUpperCase()}] ${s.name}: ${s.details}\n`;
        });
        enhanced += `\n`;
    }

    enhanced += `═══════════════════════════════════════════\n`;
    enhanced += `Report Confidence: ${Math.round((riskAttribution?.risk_score || 0) * 100)}%\n`;
    enhanced += `Pipeline: ML + Rule Engine + Graph Analysis\n`;

    return enhanced;
}

function generateTemplateNarrative(caseData, mlInsights, riskAttribution) {
    const txns = caseData.transactions || [];
    const evidenceItems = caseData.evidence || [];
    const totalAmount = txns.reduce((s, t) => s + parseFloat(t.amount || 0), 0);
    const typologies = riskAttribution?.typologies || [];

    let narrative = `SAR REPORT — JURISDICTION: ${caseData.jurisdiction || "Global"}\n`;
    narrative += `SUBJECT: ${caseData.customerDetails?.name || "Unknown Entity"}\n\n`;

    narrative += `EXECUTIVE SUMMARY:\n`;
    narrative += `Activity detected involving ${txns.length} transaction(s) `;
    narrative += `totalling $${totalAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}. `;

    if (evidenceItems.length > 0) {
        narrative += `The ML pipeline identified ${evidenceItems.length} specific red flag(s). `;
    }

    if (typologies.length > 0) {
        narrative += `Detected patterns: ${typologies.map(t => t.replace(/_/g, " ")).join(", ")}. `;
    }

    narrative += `\n\nSUSPICIOUS ACTIVITY PATTERN:\n`;

    if (typologies.includes("smurfing")) {
        narrative += `Structuring detected — multiple sub-threshold transactions consistent with CTR evasion.\n`;
    }
    if (typologies.includes("cross_border_anomaly")) {
        narrative += `Cross-border anomalies identified across multiple jurisdictions.\n`;
    }
    if (typologies.includes("circular_transactions")) {
        narrative += `Circular fund flows detected — potential layering activity.\n`;
    }
    if (typologies.includes("rapid_movement")) {
        narrative += `Rapid fund movement across accounts within short timeframes.\n`;
    }

    if (typologies.length === 0) {
        narrative += `The subject was flagged for ${evidenceItems[0]?.evidenceType || "Suspicious Activity"}.\n`;
        narrative += `Analysis confirms patterns consistent with ${caseData.jurisdiction || "Global"} AML typologies.\n`;
    }

    narrative += `\nCONCLUSION:\n`;
    narrative += `Based on the evidence attached, this case is recommended for ${caseData.jurisdiction || "regulatory"} filing.\n`;

    narrative += `\nRisk Score: ${Math.round((riskAttribution?.risk_score || parseFloat(caseData.riskScore || 0)) * 100)}%\n`;
    narrative += `Report Generated: ${new Date().toISOString()}\n`;

    return narrative;
}