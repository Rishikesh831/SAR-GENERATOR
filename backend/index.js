import express from "express";
import helmet from "helmet";
import cors from "cors";
import caseRoutes from "./routes/caseRoutes.js";
import ingestionRoutes from "./routes/ingestionRoutes.js";
import { createServer } from 'http'; // 1. Import Node's HTTP module

const app = express();
const httpServer = createServer(app); // 3. Wrap Express with HTTP Server

// Initialize Socket.io
import { initSocket } from "./utils/socket.js";
const io = initSocket(httpServer);

const PORT = process.env.PORT || 5000;

// Middleware (LEAVE THESE AS 'app')
app.use(cors());
app.use(express.json());
app.use(helmet());

// Base Endpoints (LEAVE THESE AS 'app')
app.get('/', (req, res) => res.send('SAR Generator API is live!'));
app.get('/health', (req, res) => res.status(200).json({ status: 'OK' }));

// Layer 1: Ingestion Routes
app.use("/api/ingest", ingestionRoutes);
app.use("/api/cases", caseRoutes);

// Socket.io Connection Logic
io.on('connection', (socket) => {
    console.log(`🔌 Analyst Connected: ${socket.id}`);

    socket.on('join-case', (caseId) => {
        socket.join(caseId);
        console.log(`📁 Joined Case Room: ${caseId}`);
    });
});

// 4. CRITICAL CHANGE: Listen on 'httpServer', NOT 'app'
httpServer.listen(PORT, () => {
    console.log(`🚀 Server & Sockets listening on port ${PORT}`);
});

import './worker.js';