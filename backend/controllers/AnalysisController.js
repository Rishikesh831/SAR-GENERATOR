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
            .set({ status: "ANALYZING" })
            .where(eq(cases.id, id));

        // Wait for 2 seconds to mimic heavy computation
        await delay(2000);

        // 3. 🕸️ MOCK ML RESULTS
        const mockMlResults = {
            risk_score: 0.94,
            risk_level: "HIGH",
            alerts: [
                { type: "STRUCTURING_SMURFING", explanation: "Pattern detected: 47 micro-deposits." }
            ],
            graph_patterns: [
                {
                    pattern_type: "smurfing",
                    // ADD NODES HERE TO GET 'TRUE'
                    nodes: ["A756", "B202", "C990"],
                    links: [
                        { source: "A756", target: "B202" },
                        { source: "B202", target: "C990" }
                    ]
                }
            ]
        };

        //  Step 4 (Update Database)
        const [updatedCase] = await db.update(cases)
            .set({
                status: 'FLAGGED',
                riskScore: mockMlResults.risk_score.toString(),
                riskLevel: mockMlResults.risk_level,
                mlInsights: mockMlResults,
                // REASON: Link the broken laws to the case so frontend can display them
                violatedLaws: ["PMLA Section 3", "BSA 31 CFR"],
                // REASON: Move the progress bar for the UI
                pipelineStatus: {
                    ingestion: "completed",
                    enrichment: "completed",
                    ml_analysis: "completed",
                    narrative_gen: "pending"
                }
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