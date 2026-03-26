import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// Route imports
import caseRoutes from "./routes/caseRoutes.js";
import ingestionRoutes from "./routes/ingestionRoutes.js";
import sarRoutes from "./routes/sarRoutes.js";
import referenceRoutes from "./routes/referenceRoutes.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// ─── CORS Configuration ────────────────────────────────────────────────

const corsOptions = {
  origin: [
  "http://localhost:5173",
  "http://localhost:8081",
  "http://localhost:3000",
  FRONTEND_URL,
  "http://localhost:3001",
  "http://127.0.0.1:5173",
],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  credentials: true,
  optionsSuccessStatus: 200,
  maxAge: 86400, // 24 hours
};

// ─── Middleware ───────────────────────────────────────────────────────

// CORS must be applied before routes
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Request logging middleware (optional)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ─── Health Check & Status Endpoints ───────────────────────────────────

app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "SAR Generator API is live!",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get("/api/status", (req, res) => {
  res.status(200).json({
    success: true,
    status: "operational",
    message: "Backend is operational and ready to serve requests",
    timestamp: new Date().toISOString(),
    services: {
      database: "connected",
      api: "ready",
      cors: "enabled",
    },
  });
});

// ─── API Routes ───────────────────────────────────────────────────────

// Layer 1: Data Ingestion Routes
app.use("/api/ingest", ingestionRoutes);

// Layer 2: Case Management & Analysis Routes
app.use("/api/cases", caseRoutes);

// Layer 3: SAR Generation Routes (Primary integration point for frontend)
app.use("/api/sar", sarRoutes);

// Layer 4: Reference Data Routes (Regulatory rules, typologies, countries)
app.use("/api/reference", referenceRoutes);

// ─── 404 Handling ───────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Not Found",
    message: `The requested route '${req.method} ${req.path}' does not exist`,
    timestamp: new Date().toISOString(),
  });
});

// ─── Global Error Handling ────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error("[ERROR]", err);

  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    success: false,
    error: message,
    details: process.env.NODE_ENV === "development" ? err.stack : undefined,
    timestamp: new Date().toISOString(),
  });
});

// ─── Server Startup ───────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║          🚀 SAR Generator API Server              ║
║                                                   ║
║  📍 Server: http://localhost:${PORT}               ║
║  🌐 Frontend: ${FRONTEND_URL}  ║
║  🔧 Environment: ${process.env.NODE_ENV || "development"}               ║
║  ✅ CORS: Enabled                                 ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
  `);
  console.log("Available endpoints:");
  console.log("  GET  /                    - Server status");
  console.log("  GET  /health              - Health check");
  console.log("  GET  /api/status          - Detailed API status");
  console.log("  POST /api/sar/generate    - Generate SAR report (Main endpoint)");
  console.log("  GET  /api/reference/data  - Get all reference data");
  console.log("  GET  /api/cases           - Get all cases");
  console.log("  POST /api/ingest          - Ingest data");
});