Here is a **Notion-ready `.md` document** your team can paste directly into Notion or GitHub. It organizes the architecture, responsibilities, APIs, and schemas so **Frontend, Backend, and ML teams can work in parallel without blocking each other**.

---

# Explainable SAR Narrative Generator

### Hack-O-Hire System Architecture

## Overview

This project builds an **AI-assisted Suspicious Activity Report (SAR) generation system** with full auditability and explainability.

The system analyzes transaction alerts, identifies suspicious financial behavior, constructs evidence-backed reasoning, and generates a regulator-ready SAR narrative while maintaining a complete audit trail.

The architecture is designed for:

- Explainable AI
- Regulatory transparency
- Human-in-the-loop approval
- Modular development

Team responsibilities are divided into **Frontend**, **Backend**, and **ML/AI Engine** so development can proceed in parallel.

---

# System Architecture

```
Frontend (Next.js)
        │
        ▼
Backend API (Node + Express)
        │
        ▼
ML Intelligence Engine (Python Service)
        │
        ▼
PostgreSQL Database
```

---

# 7-Layer AI Investigation Pipeline

## 1. Data Ingestion & Normalization

Collect and unify financial data sources.

Inputs include:

- transaction alerts
- customer KYC data
- account metadata
- transaction history
- case management system data

Output:

```
case_dataset = {
  case_id,
  customer_profile,
  transactions[],
  alerts[]
}
```

Explainability:

Data lineage mapping showing the origin of each feature.

Example:

| Feature | Source |
| --- | --- |
| transaction_amount | Core Banking |
| customer_country | KYC Database |
| alert_type | Fraud Monitoring System |

---

## 2. External Intelligence Enrichment

Adds contextual signals from external sources.

Examples:

- high-risk jurisdictions
- financial crime typologies
- sanctions updates
- emerging laundering patterns

Output:

```
external_risk_score
country_risk_index
typology_flags
```

Explainability artifact:

Risk score explanation.

Example:

```
External Risk Score = 0.72

Factors:
- High risk jurisdiction transfer
- Recent AML advisory
- Increased trafficking reports
```

---

## 3. Suspicion Detection Engine

Detects anomalous transaction behavior.

Model type:

Gradient boosted tree model (e.g., XGBoost).

Features may include:

- transaction velocity change
- new counterparties
- cross-border activity
- round-number transfers
- account activity spikes

Output:

```
anomaly_probability
feature_contributions
```

Explainability:

SHAP feature contribution visualization.

Example:

```
Suspicion Score: 0.81

Top Contributors:
+0.30 transaction spike
+0.22 new counterparties
+0.18 cross-border transfers
```

---

## 4. Transaction Graph Intelligence

Detects suspicious money flow networks.

Accounts are nodes and transactions are edges.

Example pattern:

```
47 senders
   ↓
1 aggregator account
   ↓
offshore transfer
```

Graph metrics:

- in-degree
- out-degree
- clustering coefficient
- transaction velocity

Output:

```
graph_features
detected_typology
network_visualization
```

---

## 5. Evidence Builder & Grounding

Constructs structured evidence objects used by the LLM.

This layer prevents hallucinated information.

Example evidence object:

```
Evidence_ID: E12
Type: Transaction Cluster
Description: 47 inbound transfers in 7 days
Total Amount: ₹50,00,000
Source: transaction_database
```

Output:

```
evidence_objects = [
 E1,
 E2,
 E3
]
```

Every narrative statement must reference these evidence IDs.

---

## 6. SAR Narrative Generation

The LLM generates a regulator-ready narrative using evidence and templates.

Inputs:

- evidence objects
- SAR narrative templates
- regulatory language guidelines

Example output:

```
Between March 2 and March 9, the subject account received ₹50,00,000
from 47 unrelated accounts [E12].

The funds were subsequently transferred to an offshore account
within 24 hours [E19].
```

All prompts and outputs are logged.

---

## 7. Human Review & Audit Trail

Compliance analysts review and approve generated SAR narratives.

Capabilities:

- narrative editing
- evidence explorer
- transaction graph visualization
- investigation replay

Audit logs capture:

- input data snapshot
- ML model outputs
- graph analysis
- evidence generation
- LLM prompt and output
- human edits
- final SAR approval

Optional feature:

Replay investigation mode allowing regulators to reproduce the narrative generation process.

---

# Team Workstreams

Development is divided into three parallel workstreams.

---

# 1. Frontend Team

Stack: **React + Next.js**

### Responsibilities

- case dashboard
- investigation UI
- graph visualization
- explainability display
- SAR editor
- audit timeline

---

## Frontend Pages

### Case Dashboard

Route:

```
/cases
```

Displays list of SAR cases.

Example table:

| Case ID | Customer | Alert | Score | Status |
| --- | --- | --- | --- | --- |
| 1023 | C8892 | AML | 0.81 | Review |

API call:

```
GET /api/cases
```

---

### Case Investigation Page

Route:

```
/cases/[case_id]
```

Components:

Transaction summary

Transaction graph

Explainability panel

Evidence explorer

SAR editor

Audit timeline

---

### Transaction Graph

Recommended library:

```
react-force-graph
```

API:

```
GET /api/cases/:case_id/graph
```

---

### Explainability Panel

Displays anomaly score and feature contributions.

API:

```
GET /api/cases/:case_id/explainability
```

---

### Evidence Explorer

Table of evidence objects.

API:

```
GET /api/cases/:case_id/evidence
```

---

### SAR Narrative Editor

Editable text area for generated narrative.

API:

```
GET /api/cases/:case_id/sar
POST /api/cases/:case_id/sar
```

---

### Audit Timeline

Displays investigation history.

API:

```
GET /api/cases/:case_id/audit
```

---

## Frontend Folder Structure

```
frontend
 ├ pages
 │   ├ index.tsx
 │   ├ cases
 │   │   ├ index.tsx
 │   │   └ [case_id].tsx
 │
 ├ components
 │   ├ CaseTable.tsx
 │   ├ TransactionGraph.tsx
 │   ├ ExplainabilityPanel.tsx
 │   ├ EvidenceTable.tsx
 │   ├ SarEditor.tsx
 │   └ AuditTimeline.tsx
 │
 ├ services
 │   └ api.ts
```

---

# 2. Backend Team

Stack: **Node.js + Express**

Responsibilities:

- API gateway
- case management
- database interaction
- audit logging
- ML service communication

---

## API Endpoints

### Case Management

```
GET /api/cases
GET /api/cases/:id
POST /api/cases
```

---

### Trigger Analysis

```
POST /api/cases/:id/analyze
```

Backend sends case data to ML service.

---

### Evidence

```
GET /api/cases/:id/evidence
```

---

### Transaction Graph

```
GET /api/cases/:id/graph
```

---

### Explainability

```
GET /api/cases/:id/explainability
```

---

### SAR Narrative

```
GET /api/cases/:id/sar
POST /api/cases/:id/sar
```

---

### Audit Trail

```
GET /api/cases/:id/audit
```

---

## Backend Folder Structure

```
backend
 ├ controllers
 │   ├ caseController.js
 │   ├ analysisController.js
 │
 ├ routes
 │   ├ caseRoutes.js
 │   ├ analysisRoutes.js
 │
 ├ services
 │   ├ mlService.js
 │   └ auditService.js
 │
 ├ models
 │   ├ caseModel.js
 │   ├ evidenceModel.js
 │
 ├ db
 │   └ postgres.js
```

---

# 3. ML / AI Team

Stack: **Python + FastAPI**

Responsibilities:

- anomaly detection
- explainability
- graph intelligence
- evidence generation
- SAR narrative generation

---

## ML Service Endpoint

```
POST /analyze_case
```

Input:

```
{
 case_id,
 transactions,
 customer_profile
}
```

Output:

```
{
 anomaly_score,
 shap_values,
 graph_data,
 evidence_objects,
 sar_draft
}
```

---

## ML Pipeline

```
Input Data
   │
Feature Engineering
   │
Anomaly Detection
   │
Explainability
   │
Graph Analysis
   │
Evidence Builder
   │
Narrative Generation
```

---

# PostgreSQL Database Schema

## cases

```
case_id
customer_id
alert_type
risk_score
status
created_at
```

---

## transactions

```
tx_id
case_id
sender
receiver
amount
timestamp
country
```

---

## evidence

```
evidence_id
case_id
type
description
metadata
```

---

## sar_reports

```
case_id
generated_text
final_text
approved_by
approved_at
```

---

## audit_logs

```
log_id
case_id
stage
data
timestamp
```

---

# Integration Flow

```
1 Frontend uploads case
2 Backend stores case data
3 Backend calls ML service
4 ML service analyzes case
5 Backend saves evidence and logs
6 Frontend displays results
7 Analyst reviews and approves SAR
```

---

# Development Strategy

Teams can work independently:

Frontend builds UI components with mock data.

Backend builds APIs and database.

ML team develops detection and narrative generation.

Mock datasets should be used initially so UI and APIs can be built before ML models are finished.

---

If you'd like, I can also generate a **clean system architecture diagram (the kind hackathon judges love in demos)** that visually shows these 7 layers and the 3-team workflow.