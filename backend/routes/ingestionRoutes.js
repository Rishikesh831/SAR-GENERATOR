import express from "express";
import { ingestData } from "../controllers/IngestionController.js";

const router = express.Router();

// Layer 1: Data Ingestion Gatekeeper
router.post("/", ingestData);

export default router;