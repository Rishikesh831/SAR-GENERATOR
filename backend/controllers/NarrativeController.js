import { db } from "../middlewares/dbconfig.js";
import { cases, auditLogs } from "../src/db/schemas.ts";
import { eq } from "drizzle-orm";

// redis imports
import { Queue } from 'bullmq';
import { redisConnection } from '../middlewares/redis.js';

const narrativeQueue = new Queue('narrative-generation', { connection: redisConnection });

export const generateNarrative = async (req, res) => {
    const { id } = req.params;

    try {
        // 1. Fetch the Complete Grounding Context
        const targetCase = await db.query.cases.findFirst({
            where: eq(cases.id, id),
            with: {
                transactions: true,
                evidence: true
            }
        });

        // 2. THE HARD GATE: Human Review Check
        if (!targetCase.complianceChecklist?.evidence_attached) {
            return res.status(403).json({
                message: "Narrative blocked: Analyst must approve evidence first."
            });
        }


        const job = await narrativeQueue.add('generate-sar',
            { caseId: id },
            {
                attempts: 3, // Retry up to 3 times
                backoff: {
                    type: 'exponential', // Wait longer each time (1s, 2s, 4s...)
                    delay: 1000,
                },
                removeOnComplete: true, // Clean up Redis memory
            }
        );


        // 3. ASSEMBLE THE CONTEXT (The "Prompt")
        const promptContext = {
            jurisdiction: targetCase.jurisdiction,
            customer: targetCase.customerDetails,
            totalTransactions: targetCase.transactions.length,
            flaggedEvidence: targetCase.evidence.map(e => e.description),
            guidelines: "Use formal regulatory tone. Focus on suspicious patterns."
        };

        // 4. SIMULATE LLM GENERATION (Layer 6)
        // In the next step, this will be your fetch() to Llama 3.1 or Bedrock
        const mockNarrative = `
            SAR REPORT - JURISDICTION: ${targetCase.jurisdiction}
            SUBJECT: ${targetCase.customerDetails?.name}
            
            EXECUTIVE SUMMARY:
            Activity detected involving ${targetCase.transactions.length} transactions. 
            The ML pipeline identified ${targetCase.evidence.length} specific red flags.
            
            SUSPICIOUS ACTIVITY PATTERN:
            The subject was flagged for ${targetCase.evidence[0]?.evidenceType || "Suspicious Activity"}.
            Analysis confirms patterns consistent with ${targetCase.jurisdiction} AML typologies.
            
            CONCLUSION:
            Based on the evidence attached, this case is recommended for ${targetCase.jurisdiction} filing.
        `;

        // 5. SAVE & AUDIT (Layer 7)
        await db.transaction(async (tx) => {
            await tx.update(cases)
                .set({
                    summaryLlm: mockNarrative,
                    status: "IN_QUEUE", // Move from DRAFT to REVIEW
                    updatedAt: new Date()
                })
                .where(eq(cases.id, id));

            await tx.insert(auditLogs).values({
                caseId: id,
                action: "PUSHED TO QUEUE",
                actor: "SYSTEM", // Label the AI for the audit trail
                payload: { promptSent: promptContext }, // Storing the "Why"
                details: "Queued Automated SAR Narrative generated based on approved evidence."
            });
        });

        return res.status(202).json({
            message: "Narrative generation queued",
            jobId: job.id
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};