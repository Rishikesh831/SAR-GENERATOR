import express from "express";
import { getAllCases } from "../controllers/caseController.js";

const router = express.Router();

router.get("/", getAllCases);

export default router;