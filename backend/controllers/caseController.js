import { db } from "../middlewares/dbconfig.js";
import { cases, auditLogs } from "../src/db/schemas.ts";
import { eq } from "drizzle-orm";



// 1. Get all cases (with transactions)
export const getAllCases = async (req, res) => {
    try {
        const allCases = await db.query.cases.findMany({
            with: { transactions: true } // Same as Prisma's 'include'
        });

        return res.status(200).json({
            message: "All cases retrieved successfully",
            data: allCases
        });
    } catch (e) {
        return res.status(500).json({ message: "Internal server error", error: e.message });
    }
};

// 2. Create a new case (Direct insert)
export const postcase = async (req, res) => {
    try {
        // Drizzle .insert().returning() gives us the created record back
        const [newCase] = await db.insert(cases).values({
            status: "INGESTED"
        }).returning({ id: cases.id });

        return res.status(201).json({
            message: "Case created successfully!",
            data: newCase.id
        });
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
};

// 3. Find case by ID
export const getcasebyid = async (req, res) => {
    const { id } = req.params;
    try {
        const caseDetails = await db.query.cases.findFirst({
            where: eq(cases.id, id),
            with: { transactions: true }
        });

        if (!caseDetails) {
            return res.status(404).json({ message: "Case not found" });
        }

        return res.status(200).json({ message: "Case found!", data: caseDetails });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

// 4. Trigger Analysis (Update Status)
export const analysecase = async (req, res) => {
    const { id } = req.params;
    try {
        const updated = await db.update(cases)
            .set({ status: "ANALYZING" }) // Match your Enum name exactly
            .where(eq(cases.id, id))
            .returning();

        if (updated.length === 0) {
            return res.status(404).json({ message: "Case not found" });
        }

        return res.status(200).json({
            message: `Case with id ${id} is now processing`,
            data: updated[0]
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// 5. Delete Case
export const deletecase = async (req, res) => {
    const { id } = req.params;
    try {
        const deleted = await db.delete(cases)
            .where(eq(cases.id, id))
            .returning();

        if (deleted.length === 0) {
            return res.status(404).json({ message: "Case not found" });
        }

        return res.status(200).json({ message: `Case with id ${id} deleted successfully` });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};



// Add this new function to caseController.js
export const updateChecklist = async (req, res) => {
    const { id } = req.params;
    const { checklist } = req.body; // Expecting { identity_verified: true, ... }

    try {
        const [updated] = await db.update(cases)
            .set({ complianceChecklist: checklist })
            .where(eq(cases.id, id))
            .returning();

        // REASON: Every human action MUST be audited for compliance
        await db.insert(auditLogs).values({
            caseId: id,
            action: "CHECKLIST_UPDATED",
            actor: "ANALYST_YASH", // In real life, get this from Auth
            details: "Analyst updated the regulatory checklist."
        });

        return res.status(200).json({ data: updated.complianceChecklist });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};