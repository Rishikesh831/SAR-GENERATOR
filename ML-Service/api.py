"""
api.py
──────────────────────────────────────────────────────────────────────────────
FastAPI microservice for the SAR-Generator AML pipeline.

Endpoints
─────────────────────────────────────────────────────────────────────────────
POST  /api/v1/generate_sar   – Trigger the full 7-layer pipeline and return
                               the generated SAR + audit trail + evidence.

GET   /api/v1/evidence       – Return the latest Evidence Layer output
                               (L4 CaseBundle JSON) without running the
                               pipeline again.

GET   /api/v1/sar_report     – Return the complete SAR report: narrative text,
                               evidence bundle, and the prior-vector used.

GET   /api/v1/audit_trail    – Return the complete Layer-7 audit trail of every
                               decision event and every flagged transaction
                               recorded during the last pipeline run.
"""

import os
import json
import glob
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, Any, Dict, List

# Import the pipeline runner
from pipeline import run_pipeline, OUT_DIR

# ──────────────────────────────────────────────────────────────────────────────
#  App setup
# ──────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="SAR Generator ML Service API",
    description=(
        "Microservice API for the Anti-Money Laundering 7-Layer Detection Pipeline. "
        "Provides endpoints to trigger pipeline runs and to query the individual "
        "output layers (evidence, SAR report, audit trail)."
    ),
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)


# ──────────────────────────────────────────────────────────────────────────────
#  Pydantic schemas
# ──────────────────────────────────────────────────────────────────────────────

class PipelineRequest(BaseModel):
    human_feedback: Optional[str] = None


class PipelineResponse(BaseModel):
    case_id: str
    narrative: str
    audit_trail: dict
    case_bundle: dict


# ──────────────────────────────────────────────────────────────────────────────
#  Internal helpers
# ──────────────────────────────────────────────────────────────────────────────

def _load_json(path: str, label: str) -> dict:
    """Load a JSON file from disk, raising a clear 404 if it doesn't exist yet."""
    if not os.path.exists(path):
        raise HTTPException(
            status_code=404,
            detail=(
                f"{label} not found at '{path}'. "
                "Run POST /api/v1/generate_sar first to produce pipeline outputs."
            ),
        )
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def _load_text(path: str, label: str) -> str:
    """Load a plain-text file from disk, raising a clear 404 if missing."""
    if not os.path.exists(path):
        raise HTTPException(
            status_code=404,
            detail=(
                f"{label} not found at '{path}'. "
                "Run POST /api/v1/generate_sar first to produce pipeline outputs."
            ),
        )
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


def _latest_audit_path() -> str:
    """
    Return the path to the most recently written audit log.
    Falls back to the canonical CASE-E2E-001 log.
    """
    pattern = os.path.join(OUT_DIR, "L7_audit_log_*.json")
    candidates = sorted(glob.glob(pattern), key=os.path.getmtime, reverse=True)
    if candidates:
        return candidates[0]
    # Fallback for the default case id used by run_pipeline()
    return os.path.join(OUT_DIR, "L7_audit_log_CASE-E2E-001.json")


# ──────────────────────────────────────────────────────────────────────────────
#  Health check
# ──────────────────────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def health_check():
    """Simple health check — used by Render / hosting platforms."""
    return {"status": "ok", "service": "SAR-Generator-API", "version": "2.0.0"}


# ──────────────────────────────────────────────────────────────────────────────
#  ENDPOINT 1 — Generate SAR (runs the full 7-layer pipeline)
# ──────────────────────────────────────────────────────────────────────────────

@app.post(
    "/api/v1/generate_sar",
    response_model=PipelineResponse,
    tags=["Pipeline"],
    summary="Trigger the full AML pipeline and generate a SAR",
    response_description="Case ID, SAR narrative, evidence bundle, and full audit trail.",
)
def trigger_pipeline(request: PipelineRequest):
    """
    Runs all 7 layers of the AML detection pipeline:

    - **Layer 0** – External Context Agent (FinCEN advisory → Prior Vector)
    - **Layer 1** – Data Ingestion
    - **Layer 2** – ML Suspicion Detection (XGBoost + context bias)
    - **Layer 3** – Graph Intelligence (typology detection)
    - **Layer 4** – Evidence Builder (forensic CaseBundle)
    - **Layer 5** – SAR Generation (LLM narrative)
    - **Layer 6** – Human Review interface
    - **Layer 7** – Audit Trail (immutable event log)

    Optionally pass `human_feedback` to inject analyst notes back into the
    Context Agent and SAR generator (re-trigger loop).
    """
    try:
        result = run_pipeline(human_feedback=request.human_feedback)
        case_id = result.get("case_id", "CASE-E2E-001")

        audit_data   = _load_json(_latest_audit_path(),                          "Audit trail")
        bundle_data  = _load_json(os.path.join(OUT_DIR, "L4_evidence_bundle.json"), "Evidence bundle")

        return {
            "case_id":     case_id,
            "narrative":   result.get("narrative", ""),
            "audit_trail": audit_data,
            "case_bundle": bundle_data,
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ──────────────────────────────────────────────────────────────────────────────
#  ENDPOINT 2 — Evidence Layer (L4 CaseBundle)
# ──────────────────────────────────────────────────────────────────────────────

@app.get(
    "/api/v1/evidence",
    tags=["Outputs"],
    summary="Retrieve the latest Evidence Layer (L4 CaseBundle) as JSON",
    response_description=(
        "A structured CaseBundle containing all forensic evidence objects "
        "produced by the ML (L2) and Graph Intelligence (L3) layers."
    ),
)
def get_evidence() -> JSONResponse:
    """
    Returns the **Layer 4 Evidence Bundle** — the aggregated, fact-only
    forensic evidence collected from the ML Suspicion Engine and the Graph
    Intelligence Engine.

    This endpoint **does not** re-run the pipeline. It reads the output
    written by the last successful `POST /api/v1/generate_sar` call.

    ### Response shape
    ```json
    {
      "case_id": "CASE-E2E-001",
      "entity_id": "ACC-88392",
      "evidence": [
        {
          "source_layer": "ML_L3",
          "finding_type": "Model_Anomaly_Threshold_Exceeded",
          "forensic_facts": { ... },
          "rationale": "Anomaly score of 0.99 exceeds threshold with Z-score 3.8."
        },
        {
          "source_layer": "Graph_L4",
          "finding_type": "Smurfing_Topology_Detected",
          "forensic_facts": { ... },
          "rationale": "..."
        }
      ]
    }
    ```
    """
    bundle_path = os.path.join(OUT_DIR, "L4_evidence_bundle.json")
    data = _load_json(bundle_path, "Evidence bundle (L4)")
    return JSONResponse(content=data)


# ──────────────────────────────────────────────────────────────────────────────
#  ENDPOINT 3 — Full SAR Report
# ──────────────────────────────────────────────────────────────────────────────

@app.get(
    "/api/v1/sar_report",
    tags=["Outputs"],
    summary="Retrieve the complete generated SAR report",
    response_description=(
        "The full Suspicious Activity Report: LLM-generated narrative, "
        "evidence bundle, and the prior vector used to bias the pipeline."
    ),
)
def get_sar_report() -> JSONResponse:
    """
    Returns the **complete SAR Report** produced by the last pipeline run.

    This endpoint **does not** re-run the pipeline. It assembles the report
    from all layer outputs written by the last successful
    `POST /api/v1/generate_sar` call.

    ### Response shape
    ```json
    {
      "report_meta": {
        "case_id": "CASE-E2E-001",
        "generated_at_utc": "...",
        "pipeline_version": "2.0.0"
      },
      "sar_narrative": "On [date], account ACC-88392 ...",
      "evidence_bundle": { ... },
      "prior_vector": { ... }
    }
    ```
    """
    nar_path    = os.path.join(OUT_DIR, "L5_SAR_Narrative.txt")
    bundle_path = os.path.join(OUT_DIR, "L4_evidence_bundle.json")
    pv_path     = os.path.join(OUT_DIR, "L0_prior_vector.json")

    narrative      = _load_text(nar_path,    "SAR Narrative (L5)")
    evidence_bundle = _load_json(bundle_path, "Evidence bundle (L4)")
    prior_vector    = _load_json(pv_path,     "Prior Vector (L0)")

    # Derive case_id from the bundle (falls back to a default)
    case_id = evidence_bundle.get("case_id", "CASE-E2E-001")

    # Pull a generation timestamp from the audit log if available
    generated_at = "unknown"
    try:
        audit_data   = _load_json(_latest_audit_path(), "Audit trail")
        trail_events = audit_data.get("audit_trail", [])
        if trail_events:
            generated_at = trail_events[-1].get("timestamp", "unknown")
    except HTTPException:
        pass

    payload = {
        "report_meta": {
            "case_id":          case_id,
            "generated_at_utc": generated_at,
            "pipeline_version": "2.0.0",
        },
        "sar_narrative":   narrative,
        "evidence_bundle": evidence_bundle,
        "prior_vector":    prior_vector,
    }
    return JSONResponse(content=payload)


# ──────────────────────────────────────────────────────────────────────────────
#  ENDPOINT 4 — Full Audit Trail
# ──────────────────────────────────────────────────────────────────────────────

@app.get(
    "/api/v1/audit_trail",
    tags=["Outputs"],
    summary="Retrieve the complete Layer-7 audit trail",
    response_description=(
        "An immutable, chronological log of every AI decision and every "
        "flagged transaction recorded across all pipeline layers."
    ),
)
def get_audit_trail() -> JSONResponse:
    """
    Returns the **complete Layer-7 Audit Trail** — an append-only log that
    records every step taken by the pipeline to reach its final SAR decision.

    The audit captures:
    - Every layer transition and the parameters used
    - ML flagged transactions (score ≥ 0.85)
    - Graph-topology flagged transactions
    - Human review decisions (approve / reject)
    - Pipeline re-trigger events

    This endpoint **does not** re-run the pipeline. It reads the JSON file
    written by the last successful `POST /api/v1/generate_sar` call.

    ### Response shape
    ```json
    {
      "case_id": "CASE-E2E-001",
      "audit_trail": [
        {
          "timestamp": "2026-03-28T...",
          "layer": "SYSTEM",
          "action": "AuditTrail Initialized",
          "details": { "case_id": "CASE-E2E-001" }
        },
        ...
      ],
      "flagged_transactions_count": 42,
      "flagged_transactions": [
        {
          "timestamp": "...",
          "transaction_id": "TX-001",
          "sender": "ACC-111",
          "receiver": "ACC-222",
          "amount": 9500.0,
          "reason": "ML Anomaly Score High: 0.9732",
          "flagged_by_layer": "ML_L3"
        },
        ...
      ]
    }
    ```
    """
    audit_data = _load_json(_latest_audit_path(), "Audit trail (L7)")
    return JSONResponse(content=audit_data)


# ──────────────────────────────────────────────────────────────────────────────
#  Entry point
# ──────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "api:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        reload=True,
    )
