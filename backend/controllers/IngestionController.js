import { db } from "../middlewares/dbconfig.js";
import { cases, transactions as transactionsTable, auditLogs } from "../src/db/schemas.ts";
import { sql, eq } from "drizzle-orm";
import { callMLGenerateSAR } from "../services/mlService.js";
import { buildFraudGraph } from "../services/fraudGraphService.js";
import { generateRiskAttribution } from "../services/riskAttributionService.js";

export const ingestData = async (req, res) => {
    try {
        const { transactions, customerMetadata } = req.body;

        // 1. Basic Validation
        if (!transactions || !Array.isArray(transactions)) {
            return res.status(400).json({ message: "Invalid transaction array" });
        }

        // 2. Regulatory Logic
        const primaryCurrency = transactions[0]?.currency || "INR";
        const jurisdictionMap = {
            "INR": "FIU-IND (India)",
            "USD": "FINCEN (USA)",
            "GBP": "UKFIU (UK)",
            "EUR": "AMLD (EU)"
        };

        const deadline = new Date();
        deadline.setDate(deadline.getDate() + 30);

        // 3. Auto-generate displayIds
        const maxCaseResult = await db.execute(
            sql`SELECT display_id FROM cases WHERE display_id LIKE 'SAR-%' ORDER BY display_id DESC LIMIT 1`
        );
        const maxCaseRow = maxCaseResult?.rows?.[0] || maxCaseResult?.[0];
        const lastCaseNum = maxCaseRow?.display_id
            ? parseInt(maxCaseRow.display_id.replace("SAR-", ""), 10)
            : 0;
        const newCaseDisplayId = `SAR-${String(lastCaseNum + 1).padStart(4, "0")}`;

        const maxTxnResult = await db.execute(
            sql`SELECT display_id FROM transactions WHERE display_id LIKE 'TXN-%' ORDER BY display_id DESC LIMIT 1`
        );
        const maxTxnRow = maxTxnResult?.rows?.[0] || maxTxnResult?.[0];
        const lastTxnNum = maxTxnRow?.display_id
            ? parseInt(maxTxnRow.display_id.replace("TXN-", ""), 10)
            : 0;

        // 4. ACID Transaction
        const result = await db.transaction(async (tx) => {

            // Step A: Create the Case with displayId + customer metadata
            const newCaseArr = await tx.insert(cases).values({
                displayId: newCaseDisplayId,
                status: 'INGESTED',
                jurisdiction: jurisdictionMap[primaryCurrency] || "Global/Other",
                deadlineDate: deadline,
                customerDetails: customerMetadata || null,
                customerId: customerMetadata?.dbId || null,
                pipelineStatus: {
                    ingestion: "completed",
                    enrichment: "pending",
                    ml_analysis: "pending",
                    narrative_gen: "pending"
                }
            }).returning({ id: cases.id, displayId: cases.displayId });
            const newCase = newCaseArr[0];

            // Step B: Map Transactions with auto displayIds
            const normalizedData = transactions.map((t, index) => ({
                displayId: `TXN-${String(lastTxnNum + index + 1).padStart(6, "0")}`,
                caseId: newCase.id,
                amount: t.amount.toString(),
                senderDetails: t.senderDetails || {},
                receiverDetails: t.receiverDetails || {},
                timestamp: new Date(t.timestamp || Date.now()),
                externalTxId: t.externalTxId || t.external_tx_id || null,
                currency: t.currency || "INR",
                category: t.category || null,
                isFlagged: t.isFlagged || false,
            }));

            await tx.insert(transactionsTable).values(normalizedData);

            // Step C: Audit
            await tx.insert(auditLogs).values({
                caseId: newCase.id,
                action: "CASE_INGESTED",
                actor: "SYSTEM",
                details: `Case ${newCaseDisplayId} ingested with ${transactions.length} transactions from ${jurisdictionMap[primaryCurrency] || "Global"} region.`
            });

            return { ...newCase, normalizedData };
        });

        console.log(`[INGEST] Case ${newCaseDisplayId} created with ${transactions.length} transactions`);

        // 5. ASYNC ML ENRICHMENT (non-blocking)
        // Runs in background — doesn't hold up the response
        enrichWithML(result.id, result.normalizedData, newCaseDisplayId).catch(err => {
            console.warn(`[INGEST] Background ML enrichment failed for ${newCaseDisplayId}: ${err.message}`);
        });

        return res.status(201).json({
            message: "Case Initialized and Ingested",
            caseId: result.id,
            displayId: result.displayId,
            deadline: deadline.toISOString()
        });

    } catch (error) {
        console.error("Ingestion Error:", error.message);
        return res.status(500).json({ error: "Failed to ingest data" });
    }
};

/**
 * Async ML enrichment — runs after ingestion response is sent
 * Updates the case with ML risk score if successful
 */
async function enrichWithML(caseId, normalizedTransactions, displayId) {
    console.log(`[ML] Starting background enrichment for ${displayId}`);

    try {
        const mlResult = await callMLGenerateSAR(normalizedTransactions, displayId);

        if (mlResult.success && mlResult.data) {
            console.log(`[ML] Response received (risk_score=${mlResult.data.risk_score})`);

            // Build graph for initial enrichment
            const graphData = buildFraudGraph(normalizedTransactions, {}, mlResult.data);
            const riskAttribution = generateRiskAttribution(
                { transactions: normalizedTransactions, displayId },
                mlResult.data,
                graphData
            );

            // Update case with ML results
            await db.update(cases)
                .set({
                    pipelineStatus: {
                        ingestion: "completed",
                        enrichment: "completed",
                        ml_analysis: "enriched",
                        narrative_gen: "pending",
                    },
                    mlInsights: {
                        ...mlResult.data,
                        risk_attribution: riskAttribution,
                        graph_patterns: graphData.flagged_paths || [],
                        clusters: graphData.clusters || [],
                        _enriched_at: new Date().toISOString(),
                    },
                    riskScore: String(riskAttribution.risk_score),
                    riskLevel: riskAttribution.risk_level,
                    updatedAt: new Date(),
                })
                .where(eq(cases.id, caseId));

            await db.insert(auditLogs).values({
                caseId,
                action: "ML_ENRICHMENT_COMPLETED",
                actor: "SYSTEM",
                details: `Background ML enrichment completed: risk=${riskAttribution.risk_score} (${riskAttribution.risk_level})`,
                payload: {
                    layer: "ML",
                    risk_score: riskAttribution.risk_score,
                    typologies: riskAttribution.typologies,
                },
            });

            console.log(`[ML] Background enrichment completed for ${displayId}: score=${riskAttribution.risk_score}`);
        }
    } catch (err) {
        console.warn(`[ML] Background enrichment failed for ${displayId}: ${err.message}`);
        // Non-critical — ingestion data is already saved
    }
}
