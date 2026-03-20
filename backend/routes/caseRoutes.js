import express from "express";
import {
    getAllCases,
    getcasebyid,
    analysecase,
    deletecase
} from "../controllers/caseController.js";
import { analyzeCase } from "../controllers/AnalysisController.js"; // The simulated AI logic

const router = express.Router();

// CRUD Operations
router.get("/", getAllCases);
router.get("/:id", getcasebyid);
router.delete("/:id", deletecase);

// Layer 3-4: The Analysis Trigger
// Note: Using the simulate AI controller we built
router.post("/:id/analyze", analyzeCase);

export default router;