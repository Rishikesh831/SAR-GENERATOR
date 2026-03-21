import express from "express";
import {
    getAllCases,
    getcasebyid,
    analysecase,
    deletecase
} from "../controllers/caseController.js";
import { analyzeCase } from "../controllers/AnalysisController.js"; // The simulated AI logic
import { getAuditTrail } from "../controllers/AuditController.js";
import { updateChecklist } from "../controllers/caseController.js";

const router = express.Router();

// CRUD Operations
router.get("/", getAllCases);
router.get("/:id", getcasebyid);
router.delete("/:id", deletecase);

// Layer 3-4: The Analysis Trigger
// Note: Using the simulate AI controller we built
router.post("/:id/analyze", analyzeCase);

router.get("/:id/audit", getAuditTrail); // NEW: For the history timeline
router.patch("/:id/checklist", updateChecklist); // NEW: For the approval checkboxes

export default router;