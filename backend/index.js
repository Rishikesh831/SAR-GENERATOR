import express from "express";
import helmet from "helmet";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";

dotenv.config();

// Route imports
import caseRoutes from "./routes/caseRoutes.js";
import ingestionRoutes from "./routes/ingestionRoutes.js";
import sarRoutes from "./routes/sarRoutes.js";
import referenceRoutes from "./routes/referenceRoutes.js";
import { getInitialData } from "./controllers/InitController.js";
import { getGlobalRisks } from "./controllers/GlobalRiskController.js";

// Middleware
import { auditMiddleware } from "./middlewares/auditMiddleware.js";

// ML Health Check
import { checkMLHealth } from "./services/mlService.js";

// Socket.IO
import { initSocket } from "./utils/socket.js";

const app = express();
const httpServer = createServer(app);
const io = initSocket(httpServer);
const PORT = process.env.PORT || 5000;

// ─── Middleware ─────────────────────────────────────
app.use(cors()); // COMPLETELY REMOVED CORS RESTRICTION - Allows all origins
app.use(express.json({ limit: "50mb" }));
app.use(helmet());
app.use(auditMiddleware);

// ─── Health / Status ────────────────────────────────
app.get("/", (req, res) =>
    res.json({ status: "online", message: "SAR Generator API is live!" })
);
app.get("/health", (req, res) =>
    res.status(200).json({ status: "OK", timestamp: new Date().toISOString() })
);

// ML Health Check endpoint
app.get("/health/ml", async (req, res) => {
    const mlHealth = await checkMLHealth();
    res.status(mlHealth.healthy ? 200 : 503).json({
        status: mlHealth.healthy ? "OK" : "DEGRADED",
        ml_api: mlHealth,
        timestamp: new Date().toISOString(),
    });
});

// ─── API Routes ─────────────────────────────────────
app.get("/api/init", getInitialData);            // Single startup call
app.use("/api/ingest", ingestionRoutes);
app.use("/api/cases", caseRoutes);
app.use("/api/sar", sarRoutes);                  // SAR generation engine
app.use("/api/reference", referenceRoutes);      // Regulatory rules & typologies
app.get("/api/global-risks", getGlobalRisks);    // Global risk aggregation (NEW)

// ─── Socket.IO ─────────────────────────────────────
io.on("connection", (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);
    socket.on("join-case", (caseId) => {
        socket.join(caseId);
        console.log(`📁 Joined case room: ${caseId}`);
    });
});

// ─── Start ─────────────────────────────────────────
httpServer.listen(PORT, async () => {
    console.log(`\n🚀 SAR Generator Backend — ML Orchestration Layer`);
    console.log(`   Server running on http://localhost:${PORT}`);
    console.log(`   ─────────────────────────────────────────────`);
    console.log(`   GET  /api/init          — Frontend startup data`);
    console.log(`   POST /api/ingest        — Transaction ingestion`);
    console.log(`   GET  /api/cases         — All cases`);
    console.log(`   POST /api/cases/:id/analyze    — ML analysis`);
    console.log(`   GET  /api/cases/:id/risk       — Risk attribution`);
    console.log(`   GET  /api/cases/:id/analytics  — Case analytics`);
    console.log(`   POST /api/cases/:id/evidence   — Evidence extraction`);
    console.log(`   POST /api/sar/generate  — SAR generation engine`);
    console.log(`   GET  /api/global-risks  — Global risk aggregation`);
    console.log(`   GET  /api/reference     — Regulatory rules & typologies`);
    console.log(`   GET  /health/ml         — ML API health check`);
    console.log(`   ─────────────────────────────────────────────`);

    // Check ML API on startup
    const mlHealth = await checkMLHealth();
    if (mlHealth.healthy) {
        console.log(`   ✅ ML API connected: ${process.env.ML_API_URL || "https://sar-generator.onrender.com"}`);
    } else {
        console.log(`   ⚠️  ML API unreachable (will use rule-based fallback)`);
    }
    console.log(``);
});

// Start background worker
import "./worker.js";

