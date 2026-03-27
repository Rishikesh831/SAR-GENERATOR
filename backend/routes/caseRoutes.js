import express from "express";
import {
    getAllCases,
    getcasebyid,
    analysecase,
    deletecase,
    updateChecklist,
    updateCase,            // ADD THIS
    resolveCluster,
} from "../controllers/caseController.js";
import { analyzeCase } from "../controllers/AnalysisController.js";
import { getAuditTrail } from "../controllers/AuditController.js";
import { extractEvidence } from "../controllers/EvidenceController.js";
import { generateNarrative } from "../controllers/NarrativeController.js";

const router = express.Router();

// CRUD
router.get("/", getAllCases);
router.get("/:id", getcasebyid);
router.patch("/:id", updateCase);              // ADD THIS (generic update)
router.post("/customer/:customerId/resolve", resolveCluster);
router.delete("/:id", deletecase);

// Pipeline
router.post("/:id/analyze", analyzeCase);
router.get("/:id/audit", getAuditTrail);
router.patch("/:id/checklist", updateChecklist);
router.post("/:id/evidence", extractEvidence);
router.post("/:id/generate-narrative", generateNarrative);

export default router;
