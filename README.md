# 🛡️ Explainable SAR Narrative Generator

> An AI-powered system that ingests financial transaction data, runs ML-based risk analysis, extracts evidence, and generates **Suspicious Activity Report (SAR)** narratives with full explainability and audit trails — featuring **real-time WebSocket updates**, **background job processing**, and a **frontend integration layer**.

---

## 📌 Project Status

| Module | Status | Notes |
|---|---|---|
| **Data Ingestion** (Layer 1–2) | ✅ Implemented & Routed | CSV/JSON transaction ingestion with validation, normalization & regulatory metadata |
| **Case Management** | ✅ Implemented & Routed | Full CRUD — list, get by ID, delete, generic update + compliance checklist |
| **Risk Analysis** (Layer 3–4) | ✅ Implemented & Routed (Mock) | Simulated ML pipeline with mock risk scores, pattern detection & violated laws |
| **Evidence Linking** (Layer 5) | ✅ Implemented & Routed | Extracts graph & typology evidence from ML insights, validates active patterns, status → `DRAFT` |
| **Narrative Generation** (Layer 6) | ✅ Implemented & Routed (Queue-based) | Compliance-gated, queued via **BullMQ + Redis**, processed by background worker, real-time result via **Socket.IO** |
| **Audit Logging** (Layer 7) | ✅ Implemented & Routed | Full audit trail query — logs created during Ingestion, Analysis, Evidence, Narrative & Checklist flows |
| **Background Worker** | ✅ Implemented | BullMQ worker auto-processes narrative jobs with retry & exponential backoff |
| **Real-Time Updates** | ✅ Implemented | Socket.IO broadcasts `narrative_ready` events to analysts on case rooms |
| **Frontend Init API** | ✅ Implemented | Single `GET /api/init` endpoint delivers all data the frontend needs in one call |
| **Customer Management** | ✅ Implemented | Dedicated `customers` table with risk ratings, KYC status, and case relations |
| **Database Seeding** | ✅ Implemented | Seed script populates 6 customers, 3 cases, 9 transactions for demo |
| **Docker Support** | ✅ Implemented | Dockerfile for containerized deployment |
| **Frontend Integration** | ✅ Implemented | Frontend fully integrated with backend via API client, Socket.IO, and Vite proxy |
| **ML Model Integration** | 🔲 Planned | ML model deployed on Render; integration with `AnalysisController` pending |

---

## 🏗️ Architecture Overview

The system follows a **7-Layer Pipeline Architecture** for processing suspicious financial activities, enhanced with an **asynchronous job queue**, **real-time WebSocket notifications**, and a **frontend data bridge**:

```
┌──────────────────────────────────────────────────────────────────┐
│                     SAR Generator Pipeline                       │
├─────────┬──────────┬──────────┬──────────┬───────────────────────┤
│ Layer 1 │ Layer 2  │ Layer 3-4│ Layer 5  │  Layer 6              │
│ Ingest  │ Enrich   │ Analyze  │ Evidence │  Narrative            │
│ (CSV)   │ (KYC/AML)│ (ML/AI)  │ (Link)   │  (LLM/BullMQ)       │
├─────────┴──────────┴──────────┴──────────┴───────────────────────┤
│                      Layer 7: Audit Trail                        │
├──────────────────────────────────────────────────────────────────┤
│  ⚡ BullMQ Worker (Redis)  │  🔌 Socket.IO  │  📡 GET /api/init  │
└──────────────────────────────────────────────────────────────────┘
```

### Full System Flow

```
                          ┌──────────────────┐
                          │   Frontend (SPA)  │
                          │  React + Vite     │
                          └────────┬─────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
               GET /api/init   PATCH /api/    Socket.IO
               (page load)     cases/:id      (real-time)
                    │              │              │
                    ▼              ▼              ▲
┌──────────────────────────────────────────────────────────────┐
│                    Express + HTTP Server                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  POST /api/ingest ──► Case Created (INGESTED)                │
│         │                                                    │
│  POST /api/cases/:id/analyze ──► ML Scoring (FLAGGED)        │
│         │                                                    │
│  POST /api/cases/:id/evidence ──► Evidence Linked (DRAFT)    │
│         │                                                    │
│  PATCH /api/cases/:id/checklist ──► Human Gate ✋             │
│         │                                                    │
│  POST /api/cases/:id/generate-narrative                      │
│         │                                                    │
│         ▼                                                    │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────────┐   │
│  │ BullMQ Queue │───►│ Redis Server │───►│ BullMQ Worker  │   │
│  └─────────────┘    └──────────────┘    └──────┬─────────┘   │
│                                                │             │
│                                    DB Update + Socket.IO     │
│                                    (narrative_ready)         │
│                                                │             │
├──────────────────────────────────────────────────────────────┤
│                PostgreSQL (Neon) — 5 Tables                   │
│  customers │ cases │ transactions │ evidence │ audit_logs     │
└──────────────────────────────────────────────────────────────┘
```

### Pipeline Steps

1. **Ingest** — Creates case + transactions with regulatory metadata (status: `INGESTED`)
2. **Analyze** — Simulated ML scoring, flags patterns, sets violated laws (status: `FLAGGED`)
3. **Evidence** — Links graph/typology evidence to the case (status: `DRAFT`)
4. **Checklist** — Analyst verifies identity, transactions, and evidence (human gate)
5. **Narrative** — Blocked until `evidence_attached` is `true`, then queues job (status: `IN_QUEUE`)
6. **Worker** — Background worker picks up job, generates narrative, updates DB (status: `IN_REVIEW`)
7. **Real-time** — Socket.IO emits `narrative_ready` to all analysts watching the case room

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| **Node.js + Express 5** | Backend REST API |
| **Drizzle ORM** | Database schema, migrations, and type-safe queries |
| **Drizzle-Kit** | Schema migration tooling & SQL generation |
| **Neon (PostgreSQL)** | Serverless cloud-hosted PostgreSQL database |
| **@neondatabase/serverless** | Neon DB connection via WebSocket pooling |
| **BullMQ** | Redis-backed job queue for background narrative generation |
| **ioredis** | Redis client for BullMQ and job queue connectivity |
| **Socket.IO** | Real-time WebSocket communication for live case updates |
| **Helmet** | HTTP security headers middleware |
| **dotenv** | Environment variable management |
| **cors** | Cross-Origin Resource Sharing middleware (configured for frontend) |
| **nodemon** | Hot-reload during development |
| **tsx** | TypeScript execution for schema files |
| **Docker** | Containerized deployment |

---

## 📂 Project Structure

```
SAR-GENERATOR/
├── backend/
│   ├── controllers/                  # Request handlers for each domain
│   │   ├── InitController.js              ✅ GET /api/init — delivers all frontend data in one call
│   │   ├── IngestionController.js         ✅ Validates, normalizes & ingests transactions
│   │   ├── AnalysisController.js          ✅ Triggers simulated ML analysis pipeline
│   │   ├── caseController.js              ✅ CRUD + compliance checklist + generic case update
│   │   ├── AuditController.js             ✅ Retrieves audit trail for a case
│   │   ├── EvidenceController.js          ✅ Extracts graph & typology evidence
│   │   └── NarrativeController.js         ✅ Compliance-gated, queues job via BullMQ
│   │
│   ├── routes/
│   │   ├── caseRoutes.js                  # Case CRUD, update, analysis, evidence, narrative & audit
│   │   └── ingestionRoutes.js             # Data ingestion endpoint
│   │
│   ├── services/
│   │   └── analysisService.js             🔲 Empty — pending ML integration
│   │
│   ├── middlewares/
│   │   ├── dbconfig.js                    # Drizzle + Neon DB config & client export
│   │   └── redis.js                       # ioredis connection config for BullMQ
│   │
│   ├── utils/
│   │   └── socket.js                      # Socket.IO initialization & singleton accessor
│   │
│   ├── src/
│   │   └── db/
│   │       └── schemas.ts                 # Drizzle schema (5 tables, 2 enums, full relations)
│   │
│   ├── drizzle/
│   │   ├── 0000_stormy_mandroid.sql       # Initial migration SQL
│   │   └── meta/                          # Drizzle migration metadata
│   │
│   ├── seed.js                            # Database seeder (6 customers, 3 cases, 9 txns)
│   ├── worker.js                          # BullMQ background worker for narrative generation
│   ├── index.js                           # Express + HTTP + Socket.IO entry point
│   ├── Dockerfile                         # Docker container config (Node 20 Alpine)
│   ├── .dockerignore                      # Docker build exclusions
│   ├── drizzle.config.ts                  # Drizzle-Kit CLI configuration
│   ├── package.json                       # Dependencies & scripts
│   └── .env                               # Environment variables (DATABASE_URL, REDIS_HOST, etc.)
│
├── .gitignore
└── README.md
```

---

## 📊 Database Schema

The database is powered by **PostgreSQL (Neon)** and managed through **Drizzle ORM**. The schema defines **5 tables**, **2 enums**, and full bidirectional relations in `src/db/schemas.ts`.

### Entity Relationship Diagram

```mermaid
erDiagram
    Customer ||--o{ Case : "has many"
    Case ||--o{ Transaction : "has many"
    Case ||--o{ Evidence : "has many"
    Case ||--o{ AuditLog : "has many"

    Customer {
        UUID id PK
        String displayId UK
        String name
        StringArray accounts
        String riskRating
        String kycStatus
        String businessType
        String country
        Decimal flagCount
        Timestamp createdAt
        Timestamp updatedAt
    }

    Case {
        UUID id PK
        String displayId UK
        CaseStatus status
        UUID customerId FK
        Decimal riskScore
        RiskLevel riskLevel
        Json mlInsights
        Json customerDetails
        String jurisdiction
        StringArray violatedLaws
        Timestamp deadlineDate
        Json pipelineStatus
        Json complianceChecklist
        String summaryLlm
        String assignedTo
        Timestamp createdAt
        Timestamp updatedAt
    }

    Transaction {
        UUID id PK
        String displayId UK
        UUID caseId FK
        String externalTxId
        Decimal amount
        String currency
        Timestamp timestamp
        Json senderDetails
        Json receiverDetails
        String category
        Boolean isFlagged
    }

    Evidence {
        UUID id PK
        UUID caseId FK
        String evidenceType
        String description
        StringArray linkedTxIds
        Timestamp createdAt
    }

    AuditLog {
        UUID id PK
        UUID caseId FK
        String action
        String actor
        Json payload
        String details
        Timestamp timestamp
    }
```

### Tables

#### `customers` *(NEW)*
Customer entities tracked by the system.

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | `UUID` | `gen_random_uuid()` | Primary key |
| `display_id` | `Text` | `null` | Human-readable ID (e.g., `"CUST-0001"`) |
| `name` | `Text` | — | Customer name |
| `accounts` | `Text[]` | `[]` | Associated account IDs |
| `risk_rating` | `Text` | `"low"` | `"high"` / `"medium"` / `"low"` |
| `kyc_status` | `Text` | `"pending"` | `"verified"` / `"pending"` / `"expired"` |
| `business_type` | `Text` | `null` | e.g., "Investment Firm", "Crypto Exchange" |
| `country` | `Text` | `null` | Country code |
| `flag_count` | `Decimal` | `"0"` | Number of flagged transactions |
| `created_at` | `Timestamp` | `now()` | Record creation timestamp |
| `updated_at` | `Timestamp` | `now()` | Last modification timestamp |

**Relationships:** Has many `cases`

---

#### `cases`
The central entity representing a suspicious activity investigation.

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | `UUID` | `gen_random_uuid()` | Primary key |
| `display_id` | `Text` | `null` | Human-readable ID for frontend (e.g., `"SAR-0001"`) |
| `status` | `case_status` enum | `INGESTED` | Current pipeline stage |
| `customer_id` | `UUID` | `null` | Foreign key → `customers.id` |
| `risk_score` | `Decimal(3,2)` | `null` | ML-computed risk score (e.g., `0.94`) |
| `risk_level` | `risk_level` enum | `LOW` | Categorical risk classification |
| `ml_insights` | `JSONB` | `null` | Smurfing/funneling patterns, SHAP values, graph data |
| `customer_details` | `JSONB` | `null` | Denormalized customer metadata for rapid lookups |
| `jurisdiction` | `Text` | `null` | Regulatory jurisdiction (e.g., `"FIU-IND (India)"`) |
| `violated_laws` | `Text[]` | `null` | Array of violated law references (e.g., `"PMLA Section 3"`) |
| `deadline_date` | `Timestamp` | `null` | 30-day regulatory filing deadline |
| `pipeline_status` | `JSONB` | `{ ingestion, enrichment, ml_analysis, narrative_gen }` | Pipeline progress tracker for UI |
| `compliance_checklist` | `JSONB` | `{ identity_verified, linked_tx_verified, ... }` | Analyst review checklist |
| `summary_llm` | `Text` | `null` | AI-generated SAR narrative |
| `assigned_to` | `Text` | `null` | Analyst user ID |
| `created_at` | `Timestamp` | `now()` | Record creation timestamp |
| `updated_at` | `Timestamp` | `now()` | Last modification timestamp |

**Relationships:** Belongs to `customer`, has many `transactions`, `evidence`, `auditLogs`

---

#### `transactions`
Individual financial transactions linked to a case.

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | `UUID` | `gen_random_uuid()` | Primary key |
| `display_id` | `Text` | `null` | Human-readable ID (e.g., `"TXN-000001"`) |
| `case_id` | `UUID` | — | Foreign key → `cases.id` (cascade delete) |
| `external_tx_id` | `Text` | `null` | Original ID from bank CSV/API |
| `amount` | `Decimal(15,2)` | — | Transaction amount |
| `currency` | `Text` | `"INR"` | Currency code |
| `timestamp` | `Timestamp` | — | When the transaction occurred |
| `sender_details` | `JSONB` | — | `{ acc_id, name, country }` |
| `receiver_details` | `JSONB` | — | `{ acc_id, name, country }` |
| `category` | `Text` | `null` | e.g., "Wire Transfer", "ATM Withdrawal" |
| `is_flagged` | `Boolean` | `false` | Whether the transaction is flagged as suspicious |

---

#### `evidence`
Detected patterns and evidence items linked to a case.

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | `UUID` | `gen_random_uuid()` | Primary key |
| `case_id` | `UUID` | — | Foreign key → `cases.id` (cascade delete) |
| `evidence_type` | `Text` | — | e.g., `"NETWORK_CHAIN"`, `"STRUCTURING_SMURFING"` |
| `description` | `Text` | — | e.g., "Detected suspicious flow across 3 connected entity nodes." |
| `linked_tx_ids` | `Text[]` | — | Array of Transaction IDs that prove this evidence |
| `created_at` | `Timestamp` | `now()` | Record creation timestamp |

---

#### `audit_logs`
Immutable log of all system and analyst actions.

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | `UUID` | `gen_random_uuid()` | Primary key |
| `case_id` | `UUID` | — | Foreign key → `cases.id` |
| `action` | `Text` | — | e.g., `"CASE_INGESTED"`, `"ML_ANALYSIS_COMPLETED"`, `"PUSHED TO QUEUE"`, `"NARRATIVE_GENERATED"` |
| `actor` | `Text` | — | `"SYSTEM"`, `"SYSTEM_WORKER_LLAMA"`, or analyst name |
| `payload` | `JSONB` | `null` | Snapshot of what changed |
| `details` | `Text` | `null` | Human-readable description of the action |
| `timestamp` | `Timestamp` | `now()` | When the action occurred |

---

### Enums

#### `case_status`
Tracks the pipeline lifecycle of a case.

| Value | Description |
|---|---|
| `INGESTED` | Raw data has been received and stored |
| `ANALYZING` | ML models are processing the data |
| `FLAGGED` | ML analysis flagged the case as suspicious |
| `DRAFT` | Evidence extracted, awaiting analyst review |
| `IN_REVIEW` | SAR narrative generated, analyst is reviewing |
| `IN_QUEUE` | Narrative job queued in BullMQ, awaiting worker processing |
| `APPROVED` | Case has been approved for filing |
| `FILED` | SAR has been filed with the regulatory body |
| `FAILED` | An error occurred during processing |

#### `risk_level`
Categorical risk classification for a case.

| Value |
|---|
| `LOW` |
| `MEDIUM` |
| `HIGH` |
| `CRITICAL` |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18+
- **npm** v9+
- A **Neon** PostgreSQL database (or any PostgreSQL instance)
- **Redis** server (local or cloud — required for BullMQ job queue)
- **Docker** (optional, for containerized deployment)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Rishikesh831/SAR-GENERATOR.git
cd SAR-GENERATOR/backend

# 2. Install dependencies
npm install

# 3. Set up environment variables
#    Create a .env file in /backend with:
#    DATABASE_URL="postgresql://<user>:<password>@<host>/<database>?sslmode=require"
#    REDIS_HOST="127.0.0.1"   (or "redis" if using Docker Compose)
#    REDIS_PORT=6379

# 4. Start Redis (if running locally)
redis-server

# 5. Run Drizzle migrations
npx drizzle-kit push

# 6. Seed the database with demo data
node seed.js

# 7. Start the development server
npm run start
```

The server will be running at `http://localhost:5000`.

### Docker Deployment

```bash
# Build the Docker image
docker build -t sar-generator-backend ./backend

# Run the container
docker run -p 5000:3001 --env-file ./backend/.env sar-generator-backend
```

### Verify It Works

```bash
# Health check
curl http://localhost:5000/health
# → { "status": "OK", "timestamp": "..." }

# Root endpoint
curl http://localhost:5000/
# → { "status": "online", "message": "SAR Generator API is live!" }

# Frontend init data (should return seeded data)
curl http://localhost:5000/api/init
# → { "customers": [...], "transactions": [...], "sarReports": [...], "auditEntries": [...] }
```

### Running the Full Stack Locally

To run the entire system (Frontend + Backend + Job Queue), you need 3 terminal sessions:

**Terminal 1 (Redis):**
```bash
redis-server
```

**Terminal 2 (Backend):**
```bash
cd backend
npm install
npm start
# Runs on http://localhost:5000
```

**Terminal 3 (Frontend):**
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:8080 (Proxies /api and /socket.io to backend)
```

---

## 📡 API Endpoints

### Base Endpoints

| Method | Endpoint | Handler | Description |
|---|---|---|---|
| `GET` | `/` | `index.js` | Server status (JSON) |
| `GET` | `/health` | `index.js` | Health check with timestamp |

### Frontend Data Bridge

| Method | Endpoint | Controller | Description |
|---|---|---|---|
| `GET` | `/api/init` | `InitController.getInitialData` | Returns all customers, transactions, SAR reports & audit entries in one call. Shapes backend data to match frontend TypeScript types. |

### Layer 1: Ingestion (`/api/ingest`)

| Method | Endpoint | Controller | Description |
|---|---|---|---|
| `POST` | `/api/ingest` | `IngestionController.ingestData` | Validates, normalizes transactions & creates a new case with regulatory metadata |

### Case Management & Analysis (`/api/cases`)

| Method | Endpoint | Controller | Description |
|---|---|---|---|
| `GET` | `/api/cases` | `caseController.getAllCases` | Retrieve all cases (with transactions) |
| `GET` | `/api/cases/:id` | `caseController.getcasebyid` | Find a case by ID (with transactions) |
| `PATCH` | `/api/cases/:id` | `caseController.updateCase` | Generic case update (status, assignedTo, narrative, riskLevel) |
| `DELETE` | `/api/cases/:id` | `caseController.deletecase` | Delete a case by ID |
| `POST` | `/api/cases/:id/analyze` | `AnalysisController.analyzeCase` | Trigger simulated ML analysis pipeline |
| `GET` | `/api/cases/:id/audit` | `AuditController.getAuditTrail` | Retrieve audit trail for a case (sorted by latest) |
| `PATCH` | `/api/cases/:id/checklist` | `caseController.updateChecklist` | Update the compliance checklist for a case |
| `POST` | `/api/cases/:id/evidence` | `EvidenceController.extractEvidence` | Extract & link graph/typology evidence from ML insights |
| `POST` | `/api/cases/:id/generate-narrative` | `NarrativeController.generateNarrative` | Queue SAR narrative generation (compliance-gated, returns `202` with `jobId`) |

---

## 🔌 Real-Time Events (Socket.IO)

The server exposes a **Socket.IO** endpoint for real-time analyst notifications.

### Connection

```javascript
import { io } from "socket.io-client";
const socket = io("http://localhost:5000");
```

### Events

| Event | Direction | Payload | Description |
|---|---|---|---|
| `join-case` | Client → Server | `caseId` (string) | Join a case-specific room to receive updates |
| `narrative_ready` | Server → Client | `{ caseId, status, narrative }` | Emitted when the background worker finishes generating a narrative |

### Usage Example

```javascript
// 1. Connect & join a case room
socket.emit('join-case', 'case-uuid-123');

// 2. Listen for narrative completion
socket.on('narrative_ready', (data) => {
    console.log(`Narrative for ${data.caseId}:`, data.narrative);
});
```

---

## ⚙️ Background Worker (BullMQ)

Narrative generation is offloaded to a **BullMQ background worker** to avoid blocking the API:

| Component | File | Description |
|---|---|---|
| **Queue** | `controllers/NarrativeController.js` | Adds jobs to `narrative-generation` queue |
| **Worker** | `worker.js` | Processes jobs: fetches case context → generates narrative → saves to DB → emits Socket.IO event |
| **Redis Config** | `middlewares/redis.js` | Configures ioredis connection (supports local & Docker environments) |

### Job Lifecycle

```
NarrativeController (HTTP 202) → Redis Queue → BullMQ Worker → DB Update → Socket.IO Emit
```

### Worker Features

- **Auto-retry**: Up to 3 attempts with exponential backoff (1s → 2s → 4s)
- **Auto-cleanup**: Completed jobs are removed from Redis
- **Full context**: Worker fetches case + transactions + evidence before generating
- **Real-time push**: Emits `narrative_ready` via Socket.IO on completion

---

## 🌱 Database Seeding

The project includes a seed script (`seed.js`) that populates the database with demo data for development and testing:

```bash
node seed.js
```

**Seeds:**
- **6 customers** — Meridian Holdings, Oakwood Financial, Zenith Trading, Crimson Bay, Silvergate Capital, Baltic Freight
- **3 cases** — FLAGGED (Meridian), DRAFT (Zenith), IN_REVIEW (Silvergate)
- **9 transactions** — Wire transfers, ACH, crypto exchange, trade finance
- **3 audit logs** — Ingestion records for each case

---

## 🔄 Full Pipeline Walkthrough

Here's the complete end-to-end flow using the API:

```bash
# Step 0: Load frontend data (page load)
GET /api/init
# → { customers: [...], transactions: [...], sarReports: [...], auditEntries: [...] }

# Step 1: Ingest transaction data → Creates a new Case (INGESTED)
POST /api/ingest
Body: { "transactions": [...], "customerMetadata": {...} }

# Step 2: Trigger ML Analysis → Scores risk, detects patterns (FLAGGED)
POST /api/cases/:id/analyze

# Step 3: Extract Evidence → Links graph & typology evidence (DRAFT)
POST /api/cases/:id/evidence

# Step 4: Analyst approves checklist (Human-in-the-loop gate)
PATCH /api/cases/:id/checklist
Body: { "checklist": { "identity_verified": true, "evidence_attached": true, ... } }

# Step 5: Queue SAR Narrative → Returns 202 with jobId (IN_QUEUE)
POST /api/cases/:id/generate-narrative
# → { "message": "Narrative generation queued", "jobId": "..." }

# Step 6: Worker auto-processes → Generates narrative (IN_REVIEW)
# → Socket.IO emits 'narrative_ready' to case room

# Step 7: Approve or update case status
PATCH /api/cases/:id
Body: { "status": "approved" }

# Audit: View full audit trail at any point
GET /api/cases/:id/audit
```

---

## 🗺️ Roadmap

- [x] Set up Drizzle ORM with Neon PostgreSQL
- [x] Define database schema with enums and relations
- [x] Implement data ingestion with regulatory metadata
- [x] Implement case CRUD operations
- [x] Implement mock ML analysis pipeline
- [x] Wire all existing controllers to Express routes
- [x] Implement audit trail query endpoint
- [x] Add compliance checklist update endpoint
- [x] Implement Evidence extraction & linking logic
- [x] Implement mock SAR Narrative generation with compliance gate
- [x] Add BullMQ + Redis background job queue for narrative generation
- [x] Add Socket.IO for real-time analyst notifications
- [x] Implement background worker with retry & exponential backoff
- [x] Add Helmet security middleware
- [x] Add Docker support (Dockerfile + .dockerignore)
- [x] Add `customers` table with full schema & relations
- [x] Add `displayId` fields for frontend-friendly IDs on cases & transactions
- [x] Add `GET /api/init` — single-call frontend data bridge
- [x] Add `PATCH /api/cases/:id` — generic case update endpoint
- [x] Create database seed script with demo data
- [x] Configure CORS for frontend (ports 8080, 5173, 3000)
- [x] Wire frontend `SARDataContext` to `GET /api/init`
- [x] Add Socket.IO client to frontend for `narrative_ready` events
- [x] Replace frontend synthetic data with backend API calls
- [x] Add `POST /api/sar/save` so frontend-generated reports survive page refreshes
- [x] Auto-incrementing human-readable IDs (`SAR-0004`, `TXN-000010`) via IngestionController
- [ ] Integrate ML model from Render into `AnalysisController`
- [ ] Add authentication & authorization middleware
- [ ] Add Docker Compose for full-stack orchestration (Node + Redis + Frontend)
- [ ] Deploy backend (Render) and frontend (Vercel)

---

## 📄 License

ISC

---

<p align="center">
  <i>Built with ❤️ for making financial crime detection more transparent and explainable.</i>
</p>
