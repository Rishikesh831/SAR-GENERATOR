import express from "express";

import cors from "cors";
import caseRoutes from "./routes/caseRoutes.js";
import ingestionRoutes from "./routes/ingestionRoutes.js";


const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Base Endpoints
app.get('/', (req, res) => res.send('SAR Generator API is live!'));
app.get('/health', (req, res) => res.status(200).json({ status: 'OK' }));

// Layer 1: Ingestion Routes
app.use("/api/ingest", ingestionRoutes);

// Case Management & Analysis Routes
app.use("/api/cases", caseRoutes);

app.listen(PORT, () => {
    console.log(`🚀 Server listening on port ${PORT}`);
});