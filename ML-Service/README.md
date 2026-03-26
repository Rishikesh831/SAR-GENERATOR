# Anti-Money Laundering (AML) SAR Generator Engine

An end-to-end, multi-layered machine learning intelligence pipeline designed to detect complex money laundering typologies and automatically generate explainable, FinCEN-compliant Suspicious Activity Reports (SARs).

---

## 🧠 Philosophy & Core Concepts

The traditional approach to AI in financial compliance relies heavily on black-box LLMs that directly score transactions, leading to inevitable hallucinations and regulatory failures due to a lack of explainability.

**This engine flips that paradigm by maintaining a strict separation of concerns:**
1. **Deductive Reasoning (Pre-computation):** Context is gathered *before* data is analyzed, creating a Bayesian prior.
2. **Numeric/Topological Analysis (Feature Layers):** Complex math (XGBoost, NetworkX) handles the actual detection. 
3. **Fact-Isolation (Evidence Layer):** The LLM is denied access to external biases; it is only fed concrete, undeniable mathematical facts.
4. **Symbolic Output (Generative Layer):** The LLM is solely used for what it's best at—transforming structured data into natural language narratives.

## 🛠️ Tech Stack & Dependencies
- **Core Pipeline execution & Orchestration**: Python 3.12+
- **Machine Learning (Layer 2)**: `scikit-learn`, `xgboost`, `pandas`, `numpy`
- **Graph Topology (Layer 3)**: `networkx`
- **Data Validation & Structuring**: `pydantic`
- **Generative AI (Layer 5)**: Local LLMs via `Ollama` (`llama3.2:latest`)

---

## 🏗️ Architecture: The 7-Layer Vertical Pipeline

The system is designed as a vertical pipeline where output from one layer informs the next. Every action is observed by an overarching Audit component.

### Layer 0: External Context Agent
* **Tech:** Llama 3.2 via API over web scraped documents.
* **Concept:** Money laundering doesn't happen in a vacuum. Before looking at transactions, the context agent reads live FinCEN Advisories, FATF reports, and geopolitical news.
* **Function:** Compresses broad context into a structured JSON **Prior Vector** (e.g., `Risk Multiplier: 1.5`, `Typology Focus: Structuring`).

### Layer 1: Data Ingestion
* **Tech:** `pandas`.
* **Function:** Ingests raw KYC, account histories, and raw transaction networks. Acts as the staging area before analysis.

### Layer 2: Suspicion Detection Engine (XGBoost)
* **Tech:** `xgboost` (Binary Classifier).
* **Concept:** Bayesian probability adjustment. 
* **Function:** A base XGBoost model scores transactions on standard behavior flags (velocity spikes, transaction counts). The **Prior Vector** is then applied mathematically. If the Context Agent flagged "West Africa Structuring", transactions matching that profile receive an automatic lift in their anomaly score, pushing covert threats to the top of the alert queue.

### Layer 3: Graph Intelligence Engine
* **Tech:** `networkx`, Directed Graphs.
* **Function:** Converts tabular datasets into graph structures to search for topological typologies that tabular ML misses:
  - **Smurfing:** Many-to-one small transfers over time.
  - **Funnel Accounts:** Transitory pass-through accounts hitting multiple states.
  - **Layering:** Deep hierarchical hops.
  - **Circular Transfers (U-Turn):** A → B → C → A cycles indicative of trade-based laundering.
  *Note: Graph topology extraction is also heavily biased by the Layer 0 Prior Vector.*

### Layer 4: Evidence Builder (Fact-Isolation)
* **Tech:** `pydantic` state management.
* **Concept:** Context shouldn't write the final report. This layer collects the raw outputs from Layer 2 and 3 and standardizes them into a pure `CaseBundle` JSON.
* **Important:** Layer 0 context signals are forcefully stripped out here. The downstream LLM is forced to justify its report purely on the concrete mathematical anomalies (facts), ensuring 100% data fidelity.

### Layer 5: SAR Generation
* **Tech:** `Ollama`, Regulatory Blueprints.
* **Function:** Feeds the `CaseBundle` JSON and a FinCEN reporting schema blueprint to the LLM. It generates the final 5-part natural language narrative. Because of the protections in Layer 4, the narrative is completely grounded.

### Layer 6: Human Review Loop
* **Function:** Exposes the final SAR to a compliance analyst.
* **Action:** The analyst can approve the SAR for automated API filing, OR reject the SAR with feedback.
* **Re-trigger:** If rejected, the human's verbatim feedback is dynamically injected back into the **Layer 0 Context Agent**, and the entire pipeline executes from scratch, newly biased by human intelligence.

### Layer 7: Sub-atomic Audit Trail
* **Tech:** Immutable continuous JSON logging.
* **Concept:** Regulatory Explainability. Deep neural nets are a black-box. Regulators require "Why was this flagged?".
* **Function:** Silently rides alongside all 6 layers. Logs the exact timestamp, XGBoost score pre-and-post adjustment, exact graph edges traversed, and human interventions. Outputs to `pipeline_outputs/L7_audit_log_{id}.json` to provide bulletproof legal explainability for AI decisions.
