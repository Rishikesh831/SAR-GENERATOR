import express from "express";
import {
    getAllCases,
    getcasebyid,
    analysecase,
    deletecase,
    updateChecklist,
    updateCase,
} from "../controllers/caseController.js";
import { analyzeCase } from "../controllers/AnalysisController.js";
import { getAuditTrail } from "../controllers/AuditController.js";
import { extractEvidence } from "../controllers/EvidenceController.js";
import { generateNarrative } from "../controllers/NarrativeController.js";
import { getRiskAttribution, getCaseAnalytics } from "../controllers/RiskController.js";

const router = express.Router();

// CRUD
router.get("/", getAllCases);
router.get("/:id", getcasebyid);
router.patch("/:id", updateCase);
router.delete("/:id", deletecase);

// Pipeline
router.post("/:id/analyze", analyzeCase);
router.get("/:id/audit", getAuditTrail);
router.patch("/:id/checklist", updateChecklist);
router.post("/:id/evidence", extractEvidence);
router.post("/:id/generate-narrative", generateNarrative);

// Risk Attribution & Analytics (NEW)
router.get("/:id/risk", getRiskAttribution);
router.get("/:id/analytics", getCaseAnalytics);

export default router;
