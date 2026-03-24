# 🛡️ Explainable SAR Narrative Generator

> An AI-powered backend system that ingests financial transaction data, runs ML-based risk analysis, extracts evidence, and generates **Suspicious Activity Report (SAR)** narratives with full explainability and audit trails.

---

## 📌 Project Status

| Module | Status | Notes |
|---|---|---|
| **Data Ingestion** (Layer 1–2) | ✅ Implemented & Routed | CSV/JSON transaction ingestion with validation, normalization & regulatory metadata |
| **Case Management** | ✅ Implemented & Routed | Full CRUD — list, get by ID, delete + compliance checklist updates |
| **Risk Analysis** (Layer 3–4) | ✅ Implemented & Routed (Mock) | Simulated ML pipeline with mock risk scores, pattern detection & violated laws |
| **Evidence Linking** (Layer 5) | ✅ Implemented & Routed | Extracts graph & typology evidence from ML insights, validates active patterns, status → `DRAFT` |
| **Narrative Generation** (Layer 6) | ✅ Implemented & Routed (Mock) | Compliance-gated mock SAR generation, saves narrative & status → `IN_REVIEW` |
| **Audit Logging** (Layer 7) | ✅ Implemented & Routed | Full audit trail query — logs created during Ingestion, Analysis, Evidence, Narrative & Checklist flows |
| **Analysis Service** | 🔲 Not Started | Service file created, business logic pending |
| **Frontend** | ✅ Implemented & Deployed | React + TypeScript, Vite, shadcn/ui, Intelligence Dashboard |

---

## 🏗️ Architecture Overview

The system follows a **7-Layer Pipeline Architecture** for processing suspicious financial activities:

```
┌─────────────────────────────────────────────────────────┐
│                   SAR Generator Pipeline                │
├─────────┬──────────┬──────────┬──────────┬──────────────┤
│ Layer 1 │ Layer 2  │ Layer 3-4│ Layer 5  │  Layer 6     │
│ Ingest  │ Enrich   │ Analyze  │ Evidence │  Narrative   │
│ (CSV)   │ (KYC/AML)│ (ML/AI)  │ (Link)   │  (LLM)      │
├─────────┴──────────┴──────────┴──────────┴──────────────┤
│                   Layer 7: Audit Trail                  │
└─────────────────────────────────────────────────────────┘
```

### Pipeline Flow

```
Ingest → Analyze → Extract Evidence → [Analyst Approves Checklist] → Generate Narrative → IN_REVIEW
```

Each step is gated and audited:

1. **Ingest** — Creates case + transactions with regulatory metadata (status: `INGESTED`)
2. **Analyze** — Simulated ML scoring, flags patterns, sets violated laws (status: `FLAGGED`)
3. **Evidence** — Links graph/typology evidence to the case (status: `DRAFT`)
4. **Checklist** — Analyst verifies identity, transactions, and evidence (human gate)
5. **Narrative** — Blocked until `evidence_attached` is `true`, then generates SAR draft (status: `IN_REVIEW`)

---

## 🛠️ Tech Stack

### Backend

| Technology | Purpose |
|---|---|
| **Node.js + Express 5** | Backend REST API |
| **Drizzle ORM** | Database schema, migrations, and type-safe queries |
| **Drizzle-Kit** | Schema migration tooling & SQL generation |
| **Neon (PostgreSQL)** | Serverless cloud-hosted PostgreSQL database |
| **@neondatabase/serverless** | Neon DB connection via WebSocket pooling |
| **dotenv** | Environment variable management |
| **cors** | Cross-Origin Resource Sharing middleware |
| **nodemon** | Hot-reload during development |
| **tsx** | TypeScript execution for schema files |

### Frontend

| Technology | Purpose |
|---|---|
| **React 18** | UI framework for building interactive dashboards |
| **TypeScript** | Type-safe JavaScript for maintainability |
| **Vite** | Lightning-fast build tool & dev server |
| **Tailwind CSS** | Utility-first CSS framework for styling |
| **shadcn/ui** | High-quality React component library |
| **Framer Motion** | Animation & motion effects library |
| **React Router v6** | Client-side routing & navigation |
| **TanStack React Query** | Server state management & data fetching |
| **Radix UI** | Unstyled, accessible UI primitives (via shadcn) |
| **jsPDF + jsPDF-AutoTable** | PDF report generation |
| **Lucide React** | Icon library (500+ professional icons) |
| **Vitest** | Unit testing framework |
| **Playwright** | E2E testing & browser automation |
| **ESLint** | Code quality & linting |
| **PostCSS** | CSS transformation & vendor prefixing |
| **Spline** | 3D graphics & animations |
| **Next-Themes** | Dark mode theme switching |

---

## 📂 Project Structure

```
SAR-GENERATOR/
├── backend/
│   ├── controllers/                  # Request handlers for each domain
│   │   ├── IngestionController.js         ✅ Validates, normalizes & ingests transactions
│   │   ├── AnalysisController.js          ✅ Triggers simulated ML analysis pipeline
│   │   ├── caseController.js              ✅ CRUD + compliance checklist operations
│   │   ├── AuditController.js             ✅ Retrieves audit trail for a case
│   │   ├── EvidenceController.js          ✅ Extracts graph & typology evidence
│   │   └── NarrativeController.js         ✅ Compliance-gated mock SAR narrative generation
│   │
│   ├── routes/
│   │   ├── caseRoutes.js                  # Case CRUD, analysis, evidence, narrative & audit routes
│   │   └── ingestionRoutes.js             # Data ingestion endpoint
│   │
│   ├── services/
│   │   └── analysisService.js             🔲 Empty — pending business logic
│   │
│   ├── middlewares/
│   │   └── dbconfig.js                    # Drizzle + Neon DB config & client export
│   │
│   ├── src/
│   │   └── db/
│   │       └── schemas.ts                 # Drizzle schema (4 tables, 2 enums, full relations)
│   │
│   ├── drizzle/
│   │   ├── 0000_stormy_mandroid.sql       # Initial migration SQL
│   │   └── meta/                          # Drizzle migration metadata
│   │
│   ├── generated/                         # Auto-generated files (gitignored)
│   ├── utils/                             # Utility helpers (empty)
│   ├── index.js                           # Express app entry point
│   ├── drizzle.config.ts                  # Drizzle-Kit CLI configuration
│   ├── package.json                       # Dependencies & scripts
│   └── .env                               # Environment variables (DATABASE_URL)
│
├── frontend/                              # ✅ React + TypeScript Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── AppLayout.tsx              # Main layout wrapper with navigation
│   │   │   ├── LandingPage.tsx            # Welcome & onboarding screen
│   │   │   ├── LiveTransactionBridge.tsx  # WebSocket bridge for real-time updates
│   │   │   ├── MetricCard.tsx             # Reusable metric display card
│   │   │   ├── NavLink.tsx                # Navigation link component
│   │   │   ├── SHAPPopup.tsx              # ML explainability popup (SHAP values)
│   │   │   ├── intelligence/              # Advanced analytics dashboards
│   │   │   │   ├── IntelligenceDashboard.tsx        # Main intelligence command center
│   │   │   │   ├── GlobalThreatMap.tsx              # Animated world threat visualization
│   │   │   │   ├── EntityRelationshipGraph.tsx      # Network fraud detection
│   │   │   │   ├── GlobalTransactionHeatmap.tsx     # Geographic risk heatmap
│   │   │   │   ├── InvestigationTimeline.tsx        # SAR lifecycle timeline
│   │   │   │   ├── RealTimeAlertFeed.tsx            # Alert streaming & notifications
│   │   │   │   ├── SystemHealthIndicators.tsx       # System KPIs & monitoring
│   │   │   │   └── README.md                        # Intelligence module docs
│   │   │   ├── sar/                       # SAR-specific components
│   │   │   │   ├── SARNarrativePanel.tsx           # Narrative generation UI
│   │   │   │   ├── SARReviewForm.tsx               # Analyst review workflow
│   │   │   │   └── SARTemplate.tsx                 # Compliance filing template
│   │   │   └── ui/                        # shadcn/ui component library
│   │   │       ├── button.tsx, card.tsx, dialog.tsx, etc.
│   │   │       ├── sonner.tsx             # Toast notifications
│   │   │       └── toaster.tsx            # Toast container
│   │   │
│   │   ├── pages/
│   │   │   ├── Index.tsx                  # Landing page router
│   │   │   ├── Dashboard.tsx              # Main analytics dashboard
│   │   │   ├── Transactions.tsx           # Transaction browser & search
│   │   │   ├── FlaggedClusters.tsx        # Flagged transaction clusters
│   │   │   ├── SARGenerate.tsx            # SAR narrative generation UI
│   │   │   ├── ReviewQueue.tsx            # Analyst review pending cases
│   │   │   ├── FiledReports.tsx           # Historical filed SAR documents
│   │   │   ├── RiskGraph.tsx              # Network risk graph visualization
│   │   │   ├── Analytics.tsx              # Advanced analytics & reporting
│   │   │   ├── AuditTrail.tsx             # Case audit log viewer
│   │   │   ├── Customers.tsx              # Customer/entity management
│   │   │   ├── SettingsPage.tsx           # User preferences & configuration
│   │   │   ├── CaseDetail.tsx             # Individual case drill-down view
│   │   │   ├── AdminProfile.tsx           # Admin & user settings
│   │   │   └── NotFound.tsx               # 404 error page
│   │   │
│   │   ├── context/
│   │   │   ├── ProfileContext.tsx         # User profile & session state
│   │   │   └── SARDataContext.tsx         # Global SAR data & case state
│   │   │
│   │   ├── hooks/
│   │   │   ├── use-mobile.tsx             # Responsive design hook
│   │   │   ├── use-toast.ts               # Toast notification hook
│   │   │   └── useCSVData.ts              # CSV data loading & parsing
│   │   │
│   │   ├── lib/
│   │   │   ├── theme.ts                   # Design system & color palette
│   │   │   ├── animations.ts              # Framer Motion animations
│   │   │   ├── intelligenceEngine.ts      # Risk scoring & analytics engine
│   │   │   ├── threatDetection.ts         # Pattern detection algorithms
│   │   │   ├── csvLoader.ts               # CSV parsing utilities
│   │   │   ├── pdfExport.ts               # PDF report generation
│   │   │   └── utils.ts                   # General utility functions
│   │   │
│   │   ├── data/
│   │   │   └── synthetic.ts               # Mock data generators for dev
│   │   │
│   │   ├── test/
│   │   │   ├── example.test.ts            # Example test file
│   │   │   └── setup.ts                   # Vitest configuration
│   │   │
│   │   ├── types/                         # TypeScript type definitions
│   │   ├── App.tsx                        # Main app router & provider setup
│   │   ├── main.tsx                       # React entry point
│   │   ├── vite-env.d.ts                  # Vite environment types
│   │   ├── App.css                        # Global styles
│   │   └── index.css                      # Tailwind imports
│   │
│   ├── public/
│   │   ├── customer_kyc_dataset.csv       # Sample KYC data
│   │   ├── historical_sar_dataset.csv     # Historical SAR records
│   │   ├── network_graph_dataset.csv      # Network relationship data
│   │   ├── sar_dummy_transactions_4000_v2.csv  # Mock transaction data
│   │   ├── synthetic_aml_transactions.csv # Synthetic AML test data
│   │   ├── external_risk_intelligence_dataset.csv    # Risk indicators
│   │   ├── robots.txt                     # SEO robot directives
│   │   └── reload.html                    # Development reload page
│   │
│   ├── vite.config.ts                    # Vite build configuration
│   ├── vitest.config.ts                  # Unit test configuration
│   ├── tailwind.config.ts                # Tailwind CSS customization
│   ├── postcss.config.js                 # PostCSS processing
│   ├── tsconfig.json                     # TypeScript base configuration
│   ├── tsconfig.app.json                 # App-specific TS config
│   ├── tsconfig.node.json                # Build tool TS config
│   ├── eslint.config.js                  # ESLint rules for code quality
│   ├── playwright.config.ts              # E2E testing configuration
│   ├── playwright-fixture.ts             # Test fixture setup
│   ├── components.json                   # shadcn/ui component registry
│   ├── package.json                      # Dependencies & scripts
│   ├── INTELLIGENCE_DASHBOARD_GUIDE.md   # Intelligence module docs
│   ├── README.md                         # Frontend documentation
│   ├── index.html                        # HTML entry point
│   └── .env.local                        # API connection configuration
│
├── .gitignore
└── README.md
```

---

## 📊 Database Schema

The database is powered by **PostgreSQL (Neon)** and managed through **Drizzle ORM**. Below is a summary of all tables, enums, and relations defined in `src/db/schemas.ts`.

### Entity Relationship Diagram

```mermaid
erDiagram
    Case ||--o{ Transaction : "has many"
    Case ||--o{ Evidence : "has many"
    Case ||--o{ AuditLog : "has many"

    Case {
        UUID id PK
        CaseStatus status
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

#### `cases`
The central entity representing a suspicious activity investigation.

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | `UUID` | `gen_random_uuid()` | Primary key |
| `status` | `case_status` enum | `INGESTED` | Current pipeline stage |
| `risk_score` | `Decimal(3,2)` | `null` | ML-computed risk score (e.g., `0.94`) |
| `risk_level` | `risk_level` enum | `LOW` | Categorical risk classification |
| `ml_insights` | `JSONB` | `null` | Smurfing/funneling patterns, SHAP values, graph data |
| `customer_details` | `JSONB` | `null` | Customer metadata for rapid development |
| `jurisdiction` | `Text` | `null` | Regulatory jurisdiction (e.g., `"FIU-IND (India)"`) |
| `violated_laws` | `Text[]` | `null` | Array of violated law references (e.g., `"PMLA Section 3"`) |
| `deadline_date` | `Timestamp` | `null` | 30-day regulatory filing deadline |
| `pipeline_status` | `JSONB` | `{ ingestion, enrichment, ml_analysis, narrative_gen }` | Pipeline progress tracker for UI |
| `compliance_checklist` | `JSONB` | `{ identity_verified, linked_tx_verified, ... }` | Analyst review checklist |
| `summary_llm` | `Text` | `null` | AI-generated SAR narrative |
| `assigned_to` | `Text` | `null` | Analyst user ID |
| `created_at` | `Timestamp` | `now()` | Record creation timestamp |
| `updated_at` | `Timestamp` | `now()` | Last modification timestamp |

**Relationships:** Has many `transactions`, `evidence`, `auditLogs`

---

#### `transactions`
Individual financial transactions linked to a case.

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | `UUID` | `gen_random_uuid()` | Primary key |
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
| `evidence_type` | `Text` | — | e.g., `"NETWORK_CHAIN"`, `"STRUCTURING_SMURFING"`, `"VELOCITY_SPIKE"` |
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
| `action` | `Text` | — | e.g., `"CASE_INGESTED"`, `"ML_ANALYSIS_COMPLETED"`, `"EVIDENCE_GENERATED"`, `"NARRATIVE_GENERATED"` |
| `actor` | `Text` | — | `"SYSTEM"`, `"LLM_LLAMA_3_1"`, or analyst name |
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

## 🎨 Frontend Features

The frontend is a **professional financial intelligence dashboard** built with React + TypeScript, featuring real-time case management, advanced visualizations, and SAR narrative generation.

### 📊 Dashboard & Analytics
- **Main Dashboard** — Real-time metrics, case overview, and workflow status
- **Analytics Page** — Advanced reporting with trend analysis and KPI tracking
- **Risk Graph** — Network visualization of suspicious entity relationships
- **Flagged Clusters** — Grouped suspicious transaction patterns
- **Transaction Browser** — Search and filter transactions by multiple criteria

### 🎯 SAR Management  
- **SAR Generate Page** — AI-powered narrative generation with ML explainability
- **Review Queue** — Cases pending analyst approval with progress tracking
- **Filed Reports** — Historical SAR document storage & compliance records
- **Case Details** — Drill-down view with full transaction lineage
- **Audit Trail** — Complete activity log for each case

### 🌐 Intelligence Dashboard (Advanced Analytics)
The Intelligence Dashboard provides **14 advanced analytics modules** for comprehensive threat intelligence:

1. **Global Threat Map** — Animated world map with real-time transaction flows
2. **Entity Relationship Graph** — Network detection for money laundering chains
3. **Risk Radar Chart** — Multi-dimensional risk profile visualization  
4. **Investigation Timeline** — SAR lifecycle tracking from detection to filing
5. **Real-Time Alert Feed** — Streaming alerts with critical incident prioritization
6. **Global Transaction Heatmap** — Geographic risk density visualization
7. **SAR Narrative Panel** — Auto-generated compliance narratives with editing
8. **System Health Indicators** — Real-time system monitoring (uptime, model accuracy, latency)

### 👥 Administration & Settings
- **Customers Page** — Entity/customer profile management
- **Admin Profile** — User settings and system configuration
- **Settings Page** — Dashboard preferences and compliance settings
- **Audit Trail Page** — System-wide action logging for compliance

### 🎨 Design System
- **Dark Theme** — Professional deep navy background (#0a0e27)
- **Neon Accents** — Cyan (#00d9ff) and gold (#ffd700) highlight colors
- **Glassmorphism UI** — Semi-transparent panels with blur effects
- **Responsive Layout** — Mobile-first design with adaptive grid
- **Micro-animations** — Smooth transitions and micro-interactions using Framer Motion

### 🔌 Real-Time Features
- **WebSocket Integration** — `LiveTransactionBridge.tsx` for live updates
- **Auto-refresh Feeds** — Alert streams and timeline updates
- **Incremental Data Loading** — Lazy loading for large datasets
- **Toast Notifications** — User feedback via Sonner toaster system

### 🏗️ Frontend Component Architecture

The frontend follows a **layered component structure** for maintainability:

#### Layer 1: Page Components (`src/pages/`)
Top-level route handlers that manage page-specific state and orchestrate multiple sub-components.

```
Dashboard.tsx
  ├── MetricCard (key metrics)
  ├── TransactionChart (data viz)
  ├── RecentCases (case list)
  └── AlertFeed (real-time)
```

#### Layer 2: Feature Components (`src/components/`)
Reusable components that implement specific features or domains.

```
Intelligence Dashboard
  ├── GlobalThreatMap (world map visualization)
  ├── EntityRelationshipGraph (network graph)
  ├── RiskRadarChart (multi-factor radar)
  ├── InvestigationTimeline (event timeline)
  ├── RealTimeAlertFeed (alert stream)
  └── SystemHealthIndicators (KPI monitors)

SAR Components
  ├── SARNarrativePanel (narrative editor)
  ├── SARReviewForm (analyst review)
  └── SARTemplate (compliance template)
```

#### Layer 3: UI Components (`src/components/ui/`)
Primitive, reusable UI components from **shadcn/ui** (Radix UI + Tailwind):

```
Button | Card | Dialog | Dropdown | Form
Tabs | Alert | Badge | Progress | Slider
Tooltip | PopOver | Toast | etc.
```

#### Layer 4: Hooks (`src/hooks/`)
Custom React hooks for common logic:

```
useCSVData()           — CSV file parsing
use-mobile()           — Responsive breakpoint detection
use-toast()            — Toast notification system
```

#### Layer 5: Context (`src/context/`)
Global state management:

```
SARDataContext         — Cases, transactions, analysis results
ProfileContext         — User session, preferences
```

#### Layer 6: Utilities (`src/lib/`)
Pure functions and helpers:

```
intelligenceEngine.ts  — Risk calculations, pattern detection
threatDetection.ts     — Suspicious pattern algorithms
csvLoader.ts           — CSV parsing utilities
pdfExport.ts           — PDF report generation
theme.ts               — Design system & colors
animations.ts          — Framer Motion configs
```

---

## 💡 Developer Guide

### Quick Start Examples

#### Example 1: Using the Intelligence Dashboard

```tsx
import { IntelligenceDashboard } from '@/components/intelligence';
import { useCSVData } from '@/hooks/useCSVData';

export function IntelligenceView() {
  const { transactions } = useCSVData();
  
  return (
    <IntelligenceDashboard 
      transactionData={transactions}
    />
  );
}
```

#### Example 2: Generating SAR Narrative

```tsx
import { SARNarrativePanel, SARReviewForm } from '@/components/sar';
import { generateSARNarrative } from '@/lib/intelligenceEngine';

export function SARGenerator() {
  const [narrative, setNarrative] = useState('');
  const { selectedCase } = useSAR();
  
  const handleGenerate = async () => {
    const text = generateSARNarrative(
      selectedCase,
      selectedCase.risk_profile,
      selectedCase.detected_patterns
    );
    setNarrative(text);
  };
  
  return (
    <>
      <button onClick={handleGenerate}>Generate Narrative</button>
      <SARNarrativePanel text={narrative} />
      <SARReviewForm caseId={selectedCase.id} />
    </>
  );
}
```

#### Example 3: Real-Time Updates with WebSocket

```tsx
import { LiveTransactionBridge } from '@/components/LiveTransactionBridge';
import { useQueryClient } from '@tanstack/react-query';

export function DashboardWithLiveUpdates() {
  const queryClient = useQueryClient();
  
  const handleLiveUpdate = (data) => {
    // Invalidate cache to trigger refetch
    queryClient.invalidateQueries({ queryKey: ['cases'] });
  };
  
  return (
    <>
      <LiveTransactionBridge onUpdate={handleLiveUpdate} />
      <Dashboard />
    </>
  );
}
```

#### Example 4: Calling Backend APIs

```tsx
import { useQuery, useMutation } from '@tanstack/react-query';

// Query (GET request)
const { data: cases, isLoading } = useQuery({
  queryKey: ['cases'],
  queryFn: async () => {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/cases`);
    return res.json();
  }
});

// Mutation (POST/PATCH request)
const { mutate: generateNarrative } = useMutation({
  mutationFn: async (caseId: string) => {
    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/api/cases/${caseId}/generate-narrative`,
      { method: 'POST' }
    );
    return res.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['cases', caseId] });
  }
});
```

### Theming Guide

Customize the frontend appearance using the theme system in `src/lib/theme.ts`:

```tsx
// Colors are defined in THEME_COLORS object
THEME_COLORS.background.primary = '#0a0e27';    // Deep navy
THEME_COLORS.brand.neural = '#00d9ff';          // Cyan
THEME_COLORS.risk.critical = '#ff1744';         // Bright red

// All components automatically use updated colors
```

### Adding New Pages

1. Create page component in `src/pages/`
2. Add route in `src/App.tsx`
3. Add navigation link in `src/components/AppLayout.tsx`

---

## 🧪 Testing

```bash
# Unit tests
npm run test
npm run test:watch

# E2E tests
npx playwright test
npx playwright test --debug
```

---

### Prerequisites

- **Node.js** v18+
- **npm** v9+
- A **Neon** PostgreSQL database (or any PostgreSQL instance)

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

# 4. Run Drizzle migrations
npx drizzle-kit push

# 5. Start the development server
npm run start
```

The server will be running at `http://localhost:3000`.

### Frontend Setup

```bash
# 1. Navigate to frontend directory
cd SAR-GENERATOR/frontend

# 2. Install dependencies
npm install

# 3. Create .env.local with backend configuration:
#    VITE_API_URL=http://localhost:3000
#    VITE_ENABLE_MOCKS=true  (for development with mock data)

# 4. Start the development server
npm run dev

# 5. Open in browser
# → http://localhost:5173
```

### Build & Deployment

```bash
# Build for production
npm run build

# Preview production build locally
npm run preview

# Run tests
npm run test
npm run test:watch  # Watch mode

# Lint code
npm run lint
```

### Verify It Works

```bash
# Backend health check
curl http://localhost:3000/health
# → { "status": "OK" }

# Backend root endpoint
curl http://localhost:3000/
# → "SAR Generator API is live!"

# Frontend development server (should open automatically)
# → http://localhost:5173
```

### Environment Variables Setup

#### Backend Environment Variables (`.env`)
```env
# Database connection
DATABASE_URL="postgresql://user:password@neon-host.neon.tech/dbname?sslmode=require"

# Server configuration
PORT=3000
NODE_ENV=development

# CORS settings
FRONTEND_URL=http://localhost:5173

# Optional: LLM configuration (for future integration)
# OPENAI_API_KEY=sk-...
# LLAMA_API_KEY=...
```

#### Frontend Environment Variables (`.env.local`)
```env
# Backend API
VITE_API_URL=http://localhost:3000
VITE_API_TIMEOUT=30000

# Feature flags
VITE_ENABLE_MOCKS=false           # Set to true for development without backend
VITE_ENABLE_WEBSOCKET=true        # Enable real-time updates
VITE_DEBUG_MODE=false             # Enable debug logging

# Analytics (optional)
VITE_SENTRY_DSN=                  # Error tracking
```

---

## 📡 API Endpoints

### Base Endpoints

| Method | Endpoint | Handler | Description |
|---|---|---|---|
| `GET` | `/` | `index.js` | Server status message |
| `GET` | `/health` | `index.js` | Health check |

### Layer 1: Ingestion (`/api/ingest`)

| Method | Endpoint | Controller | Description |
|---|---|---|---|
| `POST` | `/api/ingest` | `IngestionController.ingestData` | Validates, normalizes transactions & creates a new case with regulatory metadata |

### Case Management & Analysis (`/api/cases`)

| Method | Endpoint | Controller | Description |
|---|---|---|---|
| `GET` | `/api/cases` | `caseController.getAllCases` | Retrieve all cases (with transactions) |
| `GET` | `/api/cases/:id` | `caseController.getcasebyid` | Find a case by ID (with transactions) |
| `DELETE` | `/api/cases/:id` | `caseController.deletecase` | Delete a case by ID |
| `POST` | `/api/cases/:id/analyze` | `AnalysisController.analyzeCase` | Trigger simulated ML analysis pipeline |
| `GET` | `/api/cases/:id/audit` | `AuditController.getAuditTrail` | Retrieve audit trail for a case (sorted by latest) |
| `PATCH` | `/api/cases/:id/checklist` | `caseController.updateChecklist` | Update the compliance checklist for a case |
| `POST` | `/api/cases/:id/evidence` | `EvidenceController.extractEvidence` | Extract & link graph/typology evidence from ML insights |
| `POST` | `/api/cases/:id/generate-narrative` | `NarrativeController.generateNarrative` | Generate SAR narrative (compliance-gated, requires `evidence_attached: true`) |

---

## 🔄 Full Pipeline Walkthrough

Here's the complete end-to-end flow using the API:

```bash
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

# Step 5: Generate SAR Narrative → Mock LLM output (IN_REVIEW)
POST /api/cases/:id/generate-narrative

# Audit: View full audit trail at any point
GET /api/cases/:id/audit
```

---

## � Frontend-Backend Integration

### API Client Connection

Configure your frontend to connect to the backend API:

**`frontend/.env.local`**
```env
# Backend API URL
VITE_API_URL=http://localhost:3000
VITE_API_TIMEOUT=30000

# Feature flags
VITE_ENABLE_MOCKS=false        # Use real API (set true for mock data)
VITE_ENABLE_WEBSOCKET=true     # Real-time updates
```

### Frontend Data Consumption

The frontend pages consume the backend API as follows:

| Frontend Page | Backend Endpoints Used | Status |
|---|---|---|
| **Dashboard** | `GET /api/cases` | ✅ Displays case metrics & status |
| **SARGenerate** | `GET /api/cases/:id`, `POST /api/cases/:id/generate-narrative` | ✅ Generates SAR narratives |
| **ReviewQueue** | `GET /api/cases`, `PATCH /api/cases/:id/checklist` | ✅ Analyst review workflow |
| **Transactions** | `GET /api/cases/:id` | ✅ Browse transaction lineage |
| **RiskGraph** | `GET /api/cases/:id`, `GET /api/cases/:id/audit` | ✅ Network visualization |
| **FiledReports** | `GET /api/cases` | ✅ Historical SAR archive |
| **Analytics** | `GET /api/cases`, aggregation logic | ✅ Advanced KPI reporting |
| **CaseDetail** | `GET /api/cases/:id`, `POST /api/cases/:id/analyze`, `POST /api/cases/:id/evidence` | ✅ Full case drill-down |
| **AuditTrail** | `GET /api/cases/:id/audit` | ✅ Complete activity log |
| **Intelligence Dashboard** | `GET /api/cases` + computed analytics | ✅ Advanced threat intelligence |

### State Management Architecture

#### SARDataContext
Manages global case & transaction state:
```tsx
interface SARDataContext {
  // State
  cases: Case[];
  selectedCase: Case | null;
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchCases(): Promise<Case[]>;
  selectCase(id: UUID): void;
  triggerAnalysis(caseId: UUID): Promise<Case>;
  generateNarrative(caseId: UUID): Promise<{narrative, status}>;
  updateChecklist(caseId: UUID, checklist: ComplianceChecklist): Promise<Case>;
  extractEvidence(caseId: UUID): Promise<Evidence[]>;
}
```

#### ProfileContext
Manages user session & preferences:
```tsx
interface ProfileContext {
  // User info
  user: {
    id: UUID;
    name: string;
    role: 'ANALYST' | 'ADMIN' | 'REVIEWER';
    permissions: string[];
  };
  
  // Preferences
  theme: 'dark' | 'light';
  dashboardLayout: 'compact' | 'expanded';
  autoRefresh: boolean;
  
  // Session
  isAuthenticated: boolean;
  lastActivity: Date;
}
```

### Data Flow Diagram

```
┌─────────────────────────────────────────┐
│     Frontend React Components           │
│  (Dashboard, SAR, Analytics, etc.)      │
└────────────┬────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────┐
│   Context Providers (SARData, Profile)  │
│      + React Query Cache                │
└────────────┬────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────┐
│    TanStack React Query Client          │
│  (Caching, Refetching, Mutations)       │
└────────────┬────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────┐
│      Fetch API / Axios Client           │
│   (HTTP Request/Response)               │
└────────────┬────────────────────────────┘
             │
             ↓ HTTP
┌─────────────────────────────────────────┐
│   Backend Express Server                │
│   (Port 3000)                           │
└────────────┬────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────┐
│  Controllers & Services Layer           │
└────────────┬────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────┐
│  Drizzle ORM + Business Logic           │
└────────────┬────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────┐
│   PostgreSQL Database (Neon)            │
│  (Cases, Transactions, Evidence, Audit) │
└─────────────────────────────────────────┘
```

### Real-Time Updates with WebSocket

The frontend supports **WebSocket** real-time updates via `LiveTransactionBridge.tsx`:

```tsx
// Establishes WebSocket connection to backend
// Receives live updates for:
// - New alerts
// - Case status changes
// - Transaction processing
// - ML analysis progress

import LiveTransactionBridge from '@/components/LiveTransactionBridge';

export function Dashboard() {
  return (
    <>
      <LiveTransactionBridge onUpdate={(data) => refetchCases()} />
      {/* Dashboard components */}
    </>
  );
}
```

---

## 🗺️ Roadmap

### Completed ✅
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
- [x] **Build complete frontend dashboard** (React + TypeScript)
- [x] **Intelligence Dashboard with 14 analytics modules**
- [x] **Case management and SAR generation UI**
- [x] **Real-time alert & transaction feeds**
- [x] **Frontend-Backend API integration**

### In Progress 🔄
- [ ] Add authentication & authorization middleware (JWT)
- [ ] Integrate real LLM (e.g., Llama 3.1 / Gemini / OpenAI) for narrative generation
- [ ] Build the Analysis Service with real ML model calls
- [ ] Add WebSocket support for real-time case status updates

### Planned 📋
- [ ] Docker containerization for backend & frontend
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Deploy backend (Render/Railway)
- [ ] Deploy frontend (Vercel/Netlify)
- [ ] Mobile app (React Native)
- [ ] Advanced analytics & reporting dashboards
- [ ] Multi-language support (i18n)
- [ ] Two-factor authentication (2FA)
- [ ] Role-based access control (RBAC) enhancements

---

## 👥 Team & Responsibilities

This project is being built by a distributed team with the following specializations:

| Role | Responsibilities |
|---|---|
| **Backend Lead** | Data Ingestion, Case Management, Database Schema, API Architecture |
| **ML/Analytics Engineer** | Risk Analysis, Evidence Linking, Pattern Detection, Risk Scoring |
| **Backend Services** | Narrative Generation (LLM), Audit Trails, Service Layer Architecture |
| **Frontend Lead** | React Components, UI/UX, State Management, API Integration |
| **Full-Stack** | DevOps, Deployment, Infrastructure, Monitoring |

---

## ❓ FAQ & Troubleshooting

### Backend Issues

**Q: "Cannot connect to Neon database"**
- Verify `DATABASE_URL` in `.env` is correct
- Check that you have internet connectivity
- Ensure IP is whitelisted in Neon console

**Q: "Drizzle migration fails"**
```bash
# Reset and try again
npx drizzle-kit drop
npx drizzle-kit push
```

**Q: "Port 3000 already in use"**
```bash
# Change port in index.js or use:
lsof -i :3000  # Find process
kill -9 <PID>  # Kill it
```

### Frontend Issues

**Q: "API calls returning 404"**
- Verify `VITE_API_URL` in `.env.local`
- Ensure backend is running on `http://localhost:3000`
- Check CORS settings in backend `index.js`

**Q: "Components not rendering"**
```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install
npm run dev
```

**Q: "TypeScript errors in components"**
```bash
# Rebuild TypeScript declarations
npm run build
```

### General Questions

**Q: How do I deploy this?**
- **Backend**: Deploy to Render, Railway, or Heroku
- **Frontend**: Deploy to Vercel, Netlify, or GitHub Pages
- See Deployment section (coming soon)

**Q: Can I use a different database?**
Yes! Update `DATABASE_URL` to any PostgreSQL-compatible database (AWS RDS, Supabase, etc.)

**Q: How do I integrate a real LLM?**
See roadmap. Currently uses mock narratives. Integration instructions coming soon.

**Q: Is authentication implemented?**
Not yet. Currently in roadmap for Phase 2.

---

## 📚 Documentation Resources

- **Backend API Docs** → API Endpoints section above
- **Frontend Components** → [Intelligence Dashboard Guide](frontend/INTELLIGENCE_DASHBOARD_GUIDE.md)
- **Database Schema** → Database Schema section above
- **Intelligence Engine** → See `src/lib/intelligenceEngine.ts` (JSDoc)
- **Theme System** → See `src/lib/theme.ts` (Color palette & styling)

---

## 🆘 Getting Help

1. **Check the documentation** above
2. **Search existing issues** on GitHub
3. **Create a new issue** with:
   - Clear description of the problem
   - Steps to reproduce
   - Error messages or logs
   - Environment info (Node version, OS, etc.)

---

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

ISC

---

<p align="center">
  <i>Built with ❤️ for making financial crime detection more transparent and explainable.</i>
</p>
