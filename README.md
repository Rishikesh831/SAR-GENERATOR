# SAR Generator Platform

An end-to-end Suspicious Activity Report (SAR) generation platform that pairs a 7-layer AML intelligence pipeline with a dedicated backend + frontend for investigation workflows. The primary goal is to produce explainable, regulator-ready SARs with full auditability.

## What This Repo Delivers

- **ML-Service**: 7-layer AML pipeline (context → ML → graph → evidence → LLM → audit)
- **Backend service**: API gateway for uploads, orchestration, and storage
- **Frontend service**: Analyst UI for SAR generation and review
- **Audit-first outputs**: L7 audit log + JSON SAR report

---

## System Overview

```mermaid
graph TD
    A[Analyst UI] -->|Upload CSV| B[Backend API]
    B -->|Forward CSV + feedback| C[ML-Service FastAPI]
    C --> D[Layer 0: Context Agent]
    D --> E[Layer 2: XGBoost]
    E --> F[Layer 3: Graph Intelligence]
    F --> G[Layer 4: Evidence Builder]
    G --> H[Layer 5: SAR Generation]
    H --> I[Layer 7: Audit Trail]
    C -->|JSON SAR + Audit| B
    B -->|Store + Display| A
```

---

## 7-Layer AML Pipeline (High Level)

```mermaid
flowchart LR
    L0[Layer 0: Context Agent] --> L1[Layer 1: Ingestion]
    L1 --> L2[Layer 2: Suspicion Detection]
    L2 --> L3[Layer 3: Graph Intelligence]
    L3 --> L4[Layer 4: Evidence Builder]
    L4 --> L5[Layer 5: SAR Generation]
    L5 --> L6[Layer 6: Human Review]
    L6 --> L7[Layer 7: Audit Trail]
```

---

## Data Integrity Validation (Pre-SAR)

Two validation layers run **immediately before SAR generation**:

1) **DB Presence Check**: Ensures every transaction_id exists in the database.
2) **Amount Consistency Check**: Ensures `amount` matches DB values (tolerance $0.01).

If either fails, the pipeline **terminates** and writes an audit trail.

```mermaid
sequenceDiagram
    participant P as Pipeline
    participant DB as Neon Postgres
    P->>DB: SELECT transaction_id, amount WHERE transaction_id IN (CSV)
    DB-->>P: Rows returned
    P->>P: Check missing IDs
    P->>P: Check amount mismatches
    alt any mismatch
        P-->>P: Abort pipeline + audit export
    else all good
        P->>P: Proceed to SAR generation
    end
```

---

## Outputs

- `ML-Service/pipeline_outputs/L5_SAR_Report.json`: structured SAR report
- `ML-Service/pipeline_outputs/L7_audit_log_*.json`: audit trail
- `ML-Service/pipeline_outputs/L4_evidence_bundle.json`: evidence bundle

```mermaid
graph LR
    X[CaseBundle JSON] --> Y[SAR Narrative]
    X --> Z[SAR Report JSON]
    Y --> Z
    Z --> A[Audit Log]
```

---

## Deployment Topology

```mermaid
flowchart TB
    subgraph Client
        UI[Frontend UI]
    end
    subgraph Services
        BE[Backend API]
        ML[ML-Service FastAPI]
    end
    subgraph Data
        DB[(Neon Postgres)]
        LOGS[Audit Logs]
    end

    UI -->|Upload CSV| BE
    BE -->|Forward CSV| ML
    ML -->|Validate| DB
    ML -->|SAR JSON| BE
    ML --> LOGS
    BE --> UI
```

---

## Data Model Snapshot

```mermaid
erDiagram
    TRANSACTIONS {
        string transaction_id
        string sender_account
        string receiver_account
        float amount
        string currency
        datetime timestamp
    }
    CASES {
        string case_id
        text sar_narrative
        json case_bundle_json
        string status
    }
    AUDIT_TRAILS {
        string case_id
        json audit_log_json
        json flagged_transactions
        float total_duration_seconds
    }

    TRANSACTIONS ||--o{ CASES : feeds
    CASES ||--|| AUDIT_TRAILS : generates
```

---

## Backend Service (Node.js)

### Purpose
- Accept uploads from UI
- Forward to ML-Service
- Return SAR JSON + audit

### Key Endpoint
- `POST /api/sar/generate` (multipart file upload)

### Config (backend/.env)
```
ML_SERVICE_URL=http://localhost:8000
PORT=5050
```

---

## Frontend Service (Analyst UI)

### Purpose
- Upload transaction CSV
- Show SAR JSON + summary
- View audit signals quickly

### Config (frontend/.env)
```
VITE_API_BASE=http://localhost:5050
```

---

## Local Dev (Quick Start)

1) **ML-Service**
```
cd ML-Service
uvicorn api:app --reload
```

2) **Backend**
```
cd backend
npm install
npm run dev
```

3) **Frontend**
```
cd frontend
npm install
npm run dev
```

---

## Deployment (Render)

Follow the steps in [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md) to deploy the ML-Service. The backend and frontend can be deployed as separate services on Render or similar.

---

## Repo Structure

```
SAR-Generator/
  ML-Service/           # 7-layer pipeline + FastAPI
  backend/              # Node API gateway
  frontend/             # Analyst UI
  Dataset/              # Synthetic data
```
