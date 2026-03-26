import express from "express";
import helmet from "helmet";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";

dotenv.config();

// Route imports
import caseRoutes from "./routes/caseRoutes.js";
import ingestionRoutes from "./routes/ingestionRoutes.js";
import { getInitialData } from "./controllers/InitController.js";

// Socket.IO
import { initSocket } from "./utils/socket.js";

const app = express();
const httpServer = createServer(app);
const io = initSocket(httpServer);
const PORT = process.env.PORT || 5000;

// ─── Middleware ─────────────────────────────────────
app.use(cors({
    origin: [
        "http://localhost:8080",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:8080",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
}));
app.use(express.json({ limit: "50mb" }));
app.use(helmet());

// ─── Health / Status ────────────────────────────────
app.get("/", (req, res) =>
    res.json({ status: "online", message: "SAR Generator API is live!" })
);
app.get("/health", (req, res) =>
    res.status(200).json({ status: "OK", timestamp: new Date().toISOString() })
);

// ─── API Routes ─────────────────────────────────────
app.get("/api/init", getInitialData);            // NEW: Single startup call
app.use("/api/ingest", ingestionRoutes);
app.use("/api/cases", caseRoutes);

// ─── Socket.IO ─────────────────────────────────────
io.on("connection", (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);
    socket.on("join-case", (caseId) => {
        socket.join(caseId);
        console.log(`📁 Joined case room: ${caseId}`);
    });
});

// ─── Start ─────────────────────────────────────────
httpServer.listen(PORT, () => {
    console.log(`🚀 Server & Sockets on http://localhost:${PORT}`);
    console.log(`   GET  /api/init    — Frontend startup data`);
    console.log(`   POST /api/ingest  — Transaction ingestion`);
    console.log(`   GET  /api/cases   — All cases`);
});

// Start background worker
import "./worker.js";
