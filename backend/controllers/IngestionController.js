import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const ingestData = async (req, res) => {
    try {
        const { transactions, customerMetadata } = req.body;

        // 1. 🔍 VALIDATION LOGIC
        // TODO: Write a check to see if transactions exist and is an array.
        // If not, return a 400 status with a helpful message.
        if (!transactions || !Array.isArray(transactions)) {
            return res.status(400).json({ message: `Invalid transaction type expected ${typeof (transactions)} --recieved ${typeof (transactions)}` })
        }



        // 2. 🧹 NORMALIZATION LOGIC
        // Your ML friend expects a specific format. 
        // TODO: Map through the 'transactions' array and ensure every object 
        // has: amount (as Float/Number), senderId, receiverId, and timestamp.
        const normalized_data = transactions.map(transaction => ({
            amount: parseFloat(transaction.amount),
            senderDetails: transaction.senderDetails || {},
            receiverDetails: transaction.receiverDetails || {},
            timestamp: new Date(transaction.timestamp || Date.now()),
            external_tx_id: transaction.external_tx_id || null
        }))



        // 3. 💾 DATABASE ORCHESTRATION
        // We need to create a Case AND its Transactions at the same time.
        // Prisma's "nested writes" are perfect for this.
        const newCase = await prisma.case.create({
            data: {
                status: 'INGESTED',
                customer_name: customerMetadata?.name || "Unknown",
                // TODO: Link the normalized transactions here using 'createMany'
                // Hint: transactions: { createMany: { data: normalizedArray } }
                transactions: {
                    createMany: {
                        data: normalized_data
                    }
                }
            },
        });

        // 4. 📝 AUDIT TRAIL (Layer 7)
        // TODO: Create an AuditLog entry for this new Case.
        const audit_log = await prisma.AuditLog.create(
            {
                data: {
                    caseId: newCase.id,
                    action: "CASE_INGESTED",
                    details: {
                        transactionCount: transactions.length
                    }
                }
            }
        )


        return res.status(201).json({
            message: "Data Ingested Successfully",
            caseId: newCase.id,
            count: transactions.length
        });

    } catch (error) {
        console.error("Ingestion Error:", error);
        return res.status(500).json({ error: "Failed to ingest data" });
    }
};