import { db } from "../middlewares/dbconfig.js";
import { cases, auditLogs } from "../src/db/schemas.ts";
import { eq } from "drizzle-orm";

// Helper for simulation
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const analyzeCase = async (req, res) => {
    const { id } = req.params;

    try {
        // 1. 🔍 PRE-CHECK
        // findFirst is the Drizzle equivalent of findUnique
        const targetCase = await db.query.cases.findFirst({
            where: eq(cases.id, id)
        });

        if (!targetCase) {
            return res.status(404).json({ message: "Case not found" });
        }

        if (targetCase.status === 'COMPLETED') {
            return res.status(400).json({ message: "Analysis already completed for this case" });
        }

        // 2. ⏳ SIMULATE ML PROCESSING (Update status to ANALYZING)
        await db.update(cases)
            .set({ status: "ANALYSING" })
            .where(eq(cases.id, id));

        // Wait for 2 seconds to mimic heavy computation
        await delay(2000);

        // 3. 🕸️ MOCK ML RESULTS
        const mockMlResults = {
            risk_score: 0.94,
            risk_level: "HIGH",
            alerts: [
                { type: "STRUCTURING_SMURFING", confidence: 0.97, explanation: "Pattern detected..." }
            ],
            graph_patterns: [
                { pattern_type: "smurfing", account_id: "A756", risk_score: 0.97 }
            ]
        };

        // 4. 💾 UPDATE DATABASE
        // Drizzle .update().set() syntax
        const [updatedCase] = await db.update(cases)
            .set({
                status: 'FLAGGED',
                riskScore: mockMlResults.risk_score.toString(), // Store as string for Decimal
                riskLevel: mockMlResults.risk_level,
                mlInsights: mockMlResults // Drizzle handles the JSON injection directly
            })
            .where(eq(cases.id, id))
            .returning();

        // 5. 📝 AUDIT LOG (Layer 7)
        await db.insert(auditLogs).values({
            caseId: id,
            action: "ML_ANALYSIS_COMPLETED",
            actor: "SYSTEM",
            payload: { riskScore: mockMlResults.risk_score }
        });

        return res.status(200).json({
            message: "Analysis Completed",
            riskScore: updatedCase.riskScore,
            status: updatedCase.status
        });

    } catch (error) {
        console.error("Drizzle Analysis Error:", error.message);
        return res.status(500).json({ error: "Analysis pipeline failed", details: error.message });
    }
};