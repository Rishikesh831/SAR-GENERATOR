/**
 * Reference Data Routes
 * Routes for regulatory rules, typologies, and other reference data
 */

import express from "express";
import {
  getRegulatoryRules,
  getRegulatoryRuleById,
  getTypologies,
  getTypologyById,
  getHighRiskCountries,
  getReferenceData,
} from "../controllers/ReferenceDataController.js";

const router = express.Router();

/**
 * GET /api/reference/data
 * Get all reference data at once
 */
router.get("/data", getReferenceData);

/**
 * Regulatory Rules Endpoints
 */

/**
 * GET /api/reference/regulatory-rules
 * Get all regulatory rules with optional filtering
 * Query params: jurisdiction, severity
 */
router.get("/regulatory-rules", getRegulatoryRules);

/**
 * GET /api/reference/regulatory-rules/:id
 * Get specific regulatory rule by ID
 */
router.get("/regulatory-rules/:id", getRegulatoryRuleById);

/**
 * Typologies Endpoints
 */

/**
 * GET /api/reference/typologies
 * Get all AML/CFT typologies with optional filtering
 * Query params: riskLevel
 */
router.get("/typologies", getTypologies);

/**
 * GET /api/reference/typologies/:id
 * Get specific typology by ID
 */
router.get("/typologies/:id", getTypologyById);

/**
 * High-Risk Countries Endpoints
 */

/**
 * GET /api/reference/countries
 * Get high-risk countries list with optional filtering
 * Query params: source, riskLevel
 */
router.get("/countries", getHighRiskCountries);

export default router;
