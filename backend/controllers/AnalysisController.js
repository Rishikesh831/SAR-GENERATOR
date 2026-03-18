import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Corrected delay function: Must RETURN the promise
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const analyzeCase = async (req, res) => {
    const { id } = req.params;

    try {
        // 1. 🔍 PRE-CHECK
        const targetCase = await prisma.case.findUnique({
            where: { id: id }
        });

        if (!targetCase) {
            return res.status(404).json({ message: "Case not found" });
        }

        if (targetCase.status === 'COMPLETED') {
            return res.status(400).json({ message: "Analysis already completed for this case" });
        }

        // 2. ⏳ SIMULATE ML PROCESSING (Orchestration)
        // We tell the DB we are starting
        await prisma.case.update({
            where: { id: id },
            data: { status: "ANALYSING" }
        });

        // NOW we pause the execution for 2 seconds
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
        const updatedCase = await prisma.case.update({
            where: { id: id },
            data: {
                status: 'FLAGGED',
                riskScore: mockMlResults.risk_score,
                riskLevel: mockMlResults.risk_level,
                mlInsights: mockMlResults
            }
        });

        // 5. 📝 AUDIT LOG (Layer 7)
        await prisma.auditLog.create({
            data: {
                caseId: id,
                action: "ML_ANALYSIS_COMPLETED",
                details: { riskScore: mockMlResults.risk_score }
            }
        });

        return res.status(200).json({
            message: "Analysis Completed",
            riskScore: updatedCase.riskScore,
            status: updatedCase.status
        });

    } catch (error) {
        console.error("Analysis Error:", error);
        return res.status(500).json({ error: "Analysis pipeline failed" });
    }
};