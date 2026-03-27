import { db } from "../middlewares/dbconfig.js";
import { desc } from "drizzle-orm";

/**
 * GET /api/init
 * Returns all data the frontend needs in ONE call.
 * Replaces synthetic.ts seed data on the frontend.
 */
export const getInitialData = async (req, res) => {
    try {
        // 1. Get all customers
        const allCustomers = await db.query.customers.findMany();

        // 2. Get all cases with transactions + evidence
        const allCases = await db.query.cases.findMany({
            with: { transactions: true, evidence: true },
        });

        // 3. Get recent audit logs (last 200)
        const recentAudits = await db.query.auditLogs.findMany({
            orderBy: [desc(db._.fullSchema.auditLogs.timestamp)],
            limit: 200,
        });

        // 4. Shape customers → frontend Customer type
        const customers = allCustomers.map((c) => ({
            id: c.displayId || c.id,
            name: c.name,
            accounts: c.accounts || [],
            riskRating: c.riskRating || "low",
            kycStatus: c.kycStatus || "pending",
            businessType: c.businessType || "Unknown",
            country: c.country || "Unknown",
            flagCount: parseInt(c.flagCount || "0"),
        }));

        // 5. Shape cases → frontend SARReport type
        const sarReports = allCases.map((c) => ({
            id: c.displayId || c.id,
            _dbId: c.id,                // keep the real UUID for API calls
            customerId: c.customerDetails?.id || c.displayId || c.id,
            customerName: c.customerDetails?.name || "Unknown",
            status: mapStatus(c.status),
            createdAt: c.createdAt?.toISOString?.() || new Date().toISOString(),
            updatedAt: c.updatedAt?.toISOString?.() || new Date().toISOString(),
            assignedTo: c.assignedTo || "Unassigned",
            confidenceScore: Math.round(parseFloat(c.riskScore || "0") * 100),
            modelUsed: "SAR Guardian v2",
            promptVersion: "1.0",
            daysRemaining: c.deadlineDate
                ? Math.max(0, Math.ceil((new Date(c.deadlineDate) - new Date()) / 86400000))
                : 7,
            priority:
                c.riskLevel === "HIGH" || c.riskLevel === "CRITICAL"
                    ? "high"
                    : c.riskLevel === "MEDIUM"
                        ? "medium"
                        : "low",
            narrative: c.summaryLlm || "",
            caseId: c.displayId || c.id,
            transactionIds: c.transactions.map((t) => t.displayId || t.id),
            riskBreakdown:
                c.mlInsights?.alerts?.map((a) => ({
                    label: a.type?.replace(/_/g, " ") || "Unknown",
                    value: Math.round(parseFloat(c.riskScore || "0") * 100),
                })) || [],
            triggerRules: (c.violatedLaws || []).map((law, i) => ({
                id: `RULE-${i + 1}`,
                name: law,
                confidence: 90,
            })),
            evidenceAnchors: c.evidence?.map((e) => e.description) || [],
            timelineEvents: [],
            entityType: c.customerDetails?.businessType || "Organization",
            address: c.customerDetails?.country || "",
            industryType: c.customerDetails?.businessType || "",
        }));

        // 6. Flatten transactions → frontend Transaction type
        const transactions = allCases.flatMap((c) =>
            c.transactions.map((t) => ({
                id: t.displayId || t.id,
                _dbId: t.id,
                customerId: c.customerDetails?.id || c.displayId || c.id,
                customerName: c.customerDetails?.name || "Unknown",
                amount: parseFloat(t.amount),
                currency: t.currency,
                date: t.timestamp?.toISOString?.()?.split("T")[0] || "",
                riskScore: Math.round(parseFloat(c.riskScore || "0") * 100),
                flagType: t.category?.toLowerCase()?.includes("crypto") ? "crypto" 
                    : t.category?.toLowerCase()?.includes("trade") ? "trade_based" 
                    : parseFloat(t.amount) > 50000 ? "high_value"
                    : t.category?.toLowerCase()?.includes("wire") ? "cross_border"
                    : "structuring",
                senderAccount: t.senderDetails?.acc_id || "",
                receiverAccount: t.receiverDetails?.acc_id || "",
                country: t.senderDetails?.country || "Unknown",
                type: t.category || "Wire Transfer",
            }))
        );

        // 7. Shape audit logs
        const auditEntries = recentAudits.map((a) => ({
            id: a.id,
            sarId: a.caseId,
            timestamp: a.timestamp?.toISOString?.() || new Date().toISOString(),
            user: a.actor,
            role: a.actor.includes("SYSTEM") ? "System" : "Analyst",
            action: a.action,
            details: a.details || "",
        }));

        return res.status(200).json({
            customers,
            transactions,
            sarReports,
            auditEntries,
        });
    } catch (error) {
        console.error("Init Error:", error);
        return res.status(500).json({ error: "Failed to load initial data", details: error.message });
    }
};

function mapStatus(backendStatus) {
    const map = {
        INGESTED: "draft",
        ANALYZING: "draft",
        FLAGGED: "review",
        DRAFT: "review",
        IN_REVIEW: "review",
        IN_QUEUE: "review",
        APPROVED: "approved",
        FILED: "filed",
        FAILED: "draft",
    };
    return map[backendStatus] || "draft";
}
