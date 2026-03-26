# What Layer 4 Enables

Once this exists, every other layer becomes plug-and-play.

Graph layer

Outputs:

funnel detected
layering chain
round trip

→ Evidence objects.

ML anomaly model

Outputs:

anomaly_score
shap features

→ Evidence objects.

External intelligence

Outputs:

high risk jurisdiction
sanction match

→ Evidence objects.

Evidence Flow in Your 7-Layer System
Layer 1 — Data Ingestion
        ↓
Layer 3 — ML Detection
        ↓
Layer 4 — Graph Intelligence
        ↓
Layer 2 — External Signals
        ↓
Layer 4 — Evidence Builder
        ↓
Layer 5 — SAR Narrative Generator
        ↓
Layer 7 — Audit Trail
Brutal Advice (important)

Do not let layers pass raw data to the LLM.

Always pass Evidence objects.

Bad pipeline:

LLM ← raw transactions

Good pipeline:

LLM ← evidence objects

This is the difference between:

random text generation

and

regulatory-grade explainability