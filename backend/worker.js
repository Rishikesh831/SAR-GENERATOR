import { Worker } from 'bullmq';
import { redisConnection } from './middlewares/redis.js';
import { db } from './middlewares/dbconfig.js';
import { cases, auditLogs } from './src/db/schemas.ts';
import { eq } from 'drizzle-orm';
// import { io } from './index.js';
import { getIO } from "./utils/socket.js"

const worker = new Worker('narrative-generation', async (job) => {
    const { caseId } = job.data;
    console.log(`[WORKER] Starting Narrative for Case: ${caseId}`);

    try {
        // 1. FETCH FULL CONTEXT (Grounding)
        const targetCase = await db.query.cases.findFirst({
            where: eq(cases.id, caseId),
            with: { transactions: true, evidence: true }
        });

        // 2. SIMULATE LLM LATENCY (The 5-6 hour manual task reduced to 5s)
        await new Promise(res => setTimeout(res, 5000));

        const mockNarrative = `
            SAR REPORT - JURISDICTION: ${targetCase.jurisdiction}
            SUBJECT: ${targetCase.customerDetails?.name}
            EXECUTIVE SUMMARY: Activity involving ${targetCase.transactions.length} transactions.
            PATTERNS: ${targetCase.evidence.map(e => e.evidenceType).join(", ")}.
        `;

        // call the llm here instead of simulating 

        // 3. SAVE TO DB (Layer 7 Compliance)
        await db.transaction(async (tx) => {
            await tx.update(cases)
                .set({
                    summaryLlm: mockNarrative,
                    status: "IN_REVIEW",
                    updatedAt: new Date()
                })
                .where(eq(cases.id, caseId));

            await tx.insert(auditLogs).values({
                caseId: caseId,
                action: "NARRATIVE_GENERATED",
                actor: "SYSTEM_WORKER_LLAMA",
                details: "Automated narrative generated via background worker."
            });
        });

        // 4. PUSH TO FRONTEND (Real-time update)
        getIO().to(caseId).emit('narrative_ready', {
            caseId: caseId,
            status: 'COMPLETED',
            narrative: mockNarrative
        });

        console.log(`[WORKER] Successfully generated narrative for ${caseId}`);
        return { success: true };

    } catch (error) {
        console.error(`[WORKER ERROR] Job ${job.id}:`, error);
        throw error; // Let BullMQ handle the exponential backoff
    }
}, { connection: redisConnection });