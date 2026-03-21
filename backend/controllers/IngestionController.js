import { db } from "../middlewares/dbconfig.js";
import { cases, transactions as transactionsTable, auditLogs } from "../src/db/schemas.ts";

export const ingestData = async (req, res) => {
    try {
        const { transactions, customerMetadata } = req.body;

        // 1. 🔍 Basic Validation
        if (!transactions || !Array.isArray(transactions)) {
            return res.status(400).json({ message: "Invalid transaction array" });
        }

        // 2. ⚖️ Regulatory Logic
        // Determine jurisdiction based on the first transaction's currency
        const primaryCurrency = transactions[0]?.currency || "INR";
        const jurisdictionMap = {
            "INR": "FIU-IND (India)",
            "USD": "FINCEN (USA)",
            "GBP": "UKFIU (UK)",
            "EUR": "AMLD (EU)"
        };

        // Calculate the 30-day legal deadline
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + 30);

        // 3. 💾 ACID Transaction (Using the Pool/WS driver we set up)
        const result = await db.transaction(async (tx) => {

            // Step A: Create the Case with Regulatory Metadata
            const [newCase] = await tx.insert(cases).values({
                status: 'INGESTED',
                jurisdiction: jurisdictionMap[primaryCurrency] || "Global/Other",
                deadlineDate: deadline,
                // Initialize pipeline for the frontend progress bar
                pipelineStatus: {
                    ingestion: "completed",
                    enrichment: "pending",
                    ml_analysis: "pending",
                    narrative_gen: "pending"
                }
            }).returning({ id: cases.id });

            // Step B: Map Transactions to the new Case
            const normalizedData = transactions.map(t => ({
                caseId: newCase.id,
                amount: t.amount.toString(),
                senderDetails: t.senderDetails || {},
                receiverDetails: t.receiverDetails || {},
                timestamp: new Date(t.timestamp || Date.now()),
                externalTxId: t.externalTxId || t.external_tx_id || null,
                currency: t.currency || "INR"
            }));

            await tx.insert(transactionsTable).values(normalizedData);

            // Step C: Audit the Ingestion
            await tx.insert(auditLogs).values({
                caseId: newCase.id,
                action: "CASE_INGESTED",
                actor: "SYSTEM",
                details: `Data ingested from ${jurisdictionMap[primaryCurrency]} region.`
            });

            return newCase;
        });

        return res.status(201).json({
            message: "Case Initialized and Ingested",
            caseId: result.id,
            deadline: deadline.toISOString()
        });

    } catch (error) {
        console.error("Ingestion Error:", error.message);
        return res.status(500).json({ error: "Failed to ingest data" });
    }
};