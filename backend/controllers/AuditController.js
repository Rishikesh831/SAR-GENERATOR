import { db } from "../middlewares/dbconfig.js";
import { auditLogs } from "../src/db/schemas.ts";
import { eq, desc } from "drizzle-orm";

export const getAuditTrail = async (req, res) => {
    const { id } = req.params;
    try {
        const logs = await db.query.auditLogs.findMany({
            where: eq(auditLogs.caseId, id),
            orderBy: [desc(auditLogs.timestamp)]
        });
        return res.status(200).json({ data: logs });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};