import { db } from "../middlewares/dbconfig.js";
import { cases, transactions as transactionsTable, auditLogs } from "../src/db/schemas.ts";

export const ingestData = async (req, res) => {
    try {
        const { transactions, customerMetadata } = req.body;

        // 1. 🔍 VALIDATION LOGIC
        if (!transactions || !Array.isArray(transactions)) {
            return res.status(400).json({
                message: `Invalid transaction type. Expected Array, received ${typeof transactions}`
            });
        }

        // 2. 💾 DATABASE ORCHESTRATION (The Drizzle Transaction)
        const result = await db.transaction(async (tx) => {

            // Step A: Create the Case
            const [newCase] = await tx.insert(cases).values({
                status: 'INGESTED',
            }).returning({ id: cases.id });

            // Step B: Normalize the transactions with the NEW Case ID
            const normalizedData = transactions.map(t => ({
                caseId: newCase.id, // Link to the case we just made
                amount: t.amount.toString(), // Drizzle/PG Decimal expects strings to preserve precision
                senderDetails: t.senderDetails || {},
                receiverDetails: t.receiverDetails || {},
                timestamp: new Date(t.timestamp || Date.now()),
                externalTxId: t.external_tx_id || null,
                currency: t.currency || "INR"
            }));

            // Step C: Bulk Insert Transactions
            await tx.insert(transactionsTable).values(normalizedData);

            // Step D: Create Audit Log
            await tx.insert(auditLogs).values({
                caseId: newCase.id,
                action: "CASE_INGESTED",
                actor: "SYSTEM",
                payload: { transactionCount: transactions.length }
            });

            return newCase;
        });

        // 3. ✨ SUCCESS RESPONSE
        return res.status(201).json({
            message: "Data Ingested Successfully",
            caseId: result.id,
            count: transactions.length
        });

    } catch (error) {
        console.error("Drizzle Ingestion Error:", error.message);
        return res.status(500).json({ error: "Failed to ingest data", details: error.message });
    }
};