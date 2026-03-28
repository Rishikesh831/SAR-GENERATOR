/**
 * SAR Generation Routes
 * Routes for SAR report generation, retrieval, and narrative creation
 */

import express from "express";
import {
  generateSARReport,
  getSARById,
  generateNarrative,
  saveSARReport,
} from "../controllers/SARGenerationController.js";

const router = express.Router();

/**
 * POST /api/sar/generate
 * Generate a SAR report from transaction data and context
 * Expected by frontend for trained model endpoint
 */
router.post("/generate", generateSARReport);

/**
 * GET /api/sar/:id
 * Retrieve a specific SAR report by ID
 */
router.get("/:id", getSARById);

/**
 * POST /api/sar/:id/narrative
 * Generate or enhance narrative for a SAR report
 */
router.post("/:id/narrative", generateNarrative);

/**
 * POST /api/sar/save
 * Save a SAR report to database
 */
router.post("/save", saveSARReport);

export default router;
