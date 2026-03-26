# Database Architecture: Expected I/O & Data Flow

This document details the expected input, output, and lifecycle of data as the **SAR Generator ML-Service** seamlessly integrates with a broader external system (e.g., Node.js backend with PostgreSQL/MongoDB).

---

## 🧭 The Flow & Lifecycle Overview

### 1. **Trigger Phase (When)**
* **When:** A transaction monitoring system or a scheduled cron job (running batch-processing) detects anomalies, or an investigator manually flags a case for deep analysis via a Dashboard UI.
* **How:** the Node.js backend writes a pending Case to the database and invokes the `ML-Service` pipeline via a message broker (RabbitMQ/Kafka) or a child process.

### 2. **Execution Phase (Where)**
* **Where:** Python environment.
* The `ML-Service` performs deep analysis spanning all 7 layers. It temporarily persists state strictly locally (e.g., `pipeline_outputs/` directory) to avoid overwhelming the database with intermediate tabular transformations.

### 3. **Persistence Phase (How)**
* **How:** After the Human Review or automated generation concludes successfully (Layer 6/7), the `ML-Service` outputs structured JSON payloads to the Node.js backend to fulfill and close the `Cases` record.

---

## 📥 Expected Data Inputs (from Backend DB)

The Python service expects the following structures to be synthesized or pulled from the main application database prior to execution.

### 1. `Transactions` Table/Collection
The core monetary events processed by Layer 1.
* `transaction_id` (String/UUID): Primary unique identifier.
* `sender_account` (String): Originating entity ID.
* `receiver_account` (String): Terminating entity ID.
* `amount` (Float): Transaction volume in USD (or raw format).
* `currency` (String): e.g., "USD"
* `timestamp` (DateTime): To detect velocity spikes and chronological graph topologies.
* `high_risk_country` (Boolean/Int): External risk flag on the jurisdiction.
* `below_ctr_threshold` (Boolean/Int): Flagged if amount is just under $10k (e.g., ~$9,900).

### 2. `Context_Feeds` Table/Collection
Intelligence feeds periodically synced by the backend to feed the Layer 0 Context Agent.
* `feed_id` (String): Primary ID.
* `source` (String): "FinCEN", "FATF", "Reuters", etc.
* `raw_text` (Text): The raw advisory or news body text.
* `published_at` (DateTime): Chronological relevance.
* `analyst_override` (Text): Manual text inserted by compliance officers to bias the AI.

---

## 📤 Expected Data Outputs (to Backend DB)

Once the `ML-Service` completely evaluates a case, it finalizes the process by emitting the following artifacts. The backend should update the existing system state with these outputs.

### 1. `Cases` Table/Collection Update
The resulting artifact from the Evidence Builder (Layer 4) and SAR Generator (Layer 5).
* `case_bundle_json` (JSONB): The purely factual network features, XGBoost metrics, and specific graph edge alerts stripped of subjective bias.
* `sar_narrative` (Text): The 5-part LLM generated FinCEN-compliant natural language report.
* `status` (Enum): `PENDING_REVIEW`, `APPROVED`, `REJECTED`, `FILED`.
* `analyst_feedback` (Text): Any comments injected during the Layer 6 Human Review loop.

### 2. `Audit_Trails` Table/Collection Create
The most crucial regulatory component, emitted by Layer 7.
* `case_id` (String): Foreign Key linking to the originating analysis case.
* `audit_log_json` (JSONB): The sub-atomic log tracking every math transformation and logic transition.
* `flagged_transactions` (JSONB): An array of specific `transaction_id`s that heavily contributed to Graph typologies (Smurfing, Layering) or XGBoost anomalies exceeding the 0.85 threshold.
* `total_duration_seconds` (Float): Metric for SLA tracking.

---

## 🔌 Connection Strategy to the Repo

To integrate this ML-Service prototype with your main backend (e.g. `SAR-GENERATOR/backend/` using Prisma/Express):
1. **API Wrapper:** Expose the Python pipeline using `FastAPI` inside `ML-Service`.
2. **Endpoint:** Create a `POST /analyze` endpoint that accepts the `case_id` and the context string.
3. **Database Sharing:** The Node.js app can securely query PostgreSQL and generate a temporary `.csv` in the `Dataset/` folder, or stream the data directly over the API payload to Python.
4. **Callback:** The Python FastAPI returns the `sar_narrative`, `case_bundle_json`, and `audit_log_json` directly in its HTTP response to the Express server, which then persists it via Prisma.
