"""
api.py
──────────────────────────────────────────────────────────────────────────────
FastAPI microservice for the SAR-Generator AML pipeline.

Endpoints
─────────────────────────────────────────────────────────────────────────────
POST  /api/v1/generate_sar   – Upload a transactions CSV + optional analyst
                               notes. Triggers the full 7-layer pipeline and
                               returns the generated SAR + audit trail +
                               evidence bundle.

GET   /api/v1/evidence       – Return the latest Evidence Layer output
                               (L4 CaseBundle JSON) without re-running.

GET   /api/v1/sar_report     – Return the complete SAR : narrative text,
                               evidence bundle, and the prior-vector used.

GET   /api/v1/audit_trail    – Return the complete Layer-7 audit trail of
                               every decision event and every flagged
                               transaction recorded in the last pipeline run.

Input design (POST /api/v1/generate_sar)
─────────────────────────────────────────────────────────────────────────────
  • transactions_csv  (required) – multipart file upload of the institution's
                                   transaction CSV.  The CSV drives the Graph
                                   Engine (L3) and the forensic transaction
                                   audit log.  The ML layer (L2) always uses
                                   a controlled synthetic benchmark dataset
                                   to prove Context-Agent lift; this is by
                                   design and is NOT changed by the upload.

  • human_feedback    (optional) – free-text analyst notes injected into the
                                   Context Agent (biases the Prior Vector)
                                   and appended to the SAR-generation prompt
                                   when the analyst rejects a previous report.
"""

import os
import glob
import json
import shutil
import tempfile
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from pipeline import run_pipeline, OUT_DIR

# ──────────────────────────────────────────────────────────────────────────────
#  App setup
# ──────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="SAR Generator ML Service API",
    description=(
        "Anti-Money Laundering 7-Layer Detection Pipeline.\n\n"
        "Upload your transaction CSV to `POST /api/v1/generate_sar` to run the "
        "full pipeline and produce a FinCEN-compliant Suspicious Activity Report."
    ),
    version="2.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)


# ──────────────────────────────────────────────────────────────────────────────
#  Internal helpers
# ──────────────────────────────────────────────────────────────────────────────

def _load_json(path: str, label: str) -> dict:
    """Load a JSON file, raising a descriptive 404 if it doesn't exist yet."""
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
    """Load a plain-text file, raising a descriptive 404 if missing."""
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
    """Return the most-recently-written audit log; fall back to canonical name."""
    pattern    = os.path.join(OUT_DIR, "L7_audit_log_*.json")
    candidates = sorted(glob.glob(pattern), key=os.path.getmtime, reverse=True)
    return candidates[0] if candidates else os.path.join(OUT_DIR, "L7_audit_log_CASE-E2E-001.json")


# ──────────────────────────────────────────────────────────────────────────────
#  Health check
# ──────────────────────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def health_check():
    """Simple health check — used by Render / hosting platforms."""
    return {"status": "ok", "service": "SAR-Generator-API", "version": "2.1.0"}


# ──────────────────────────────────────────────────────────────────────────────
#  ENDPOINT 1 — Generate SAR (run the full 7-layer pipeline)
# ──────────────────────────────────────────────────────────────────────────────

@app.post(
    "/api/v1/generate_sar",
    tags=["Pipeline"],
    summary="Upload a transaction CSV and generate a SAR",
    response_description=(
        "Case ID, SAR narrative, evidence bundle, and full audit trail."
    ),
)
async def trigger_pipeline(
    transactions_csv: UploadFile = File(
        ...,
        description=(
            "Institution's transaction CSV file. "
            "Must contain at minimum: transaction_id, sender_account, "
            "receiver_account, amount columns. "
            "This file drives the Graph Intelligence engine (L3) and the "
            "forensic transaction audit log."
        ),
    ),
    human_feedback: Optional[str] = Form(
        default=None,
        description=(
            "Optional analyst notes. Injected into the Context Agent to bias "
            "the Prior Vector, and appended to the SAR-generation prompt when "
            "re-triggering after a rejection."
        ),
    ),
):
    """
    Triggers all 7 layers of the AML detection pipeline using the uploaded
    transaction CSV as the primary data source.

    ### What the CSV drives
    - **L3 – Graph Intelligence**: typology detection (smurfing, funnel
      accounts, layering, circular transfers) runs entirely on the uploaded CSV.
    - **L7 – Audit Trail**: high-value flagged transactions are pulled from the
      uploaded CSV and recorded in the audit log.

    ### What the CSV does NOT change
    - **L2 – ML Suspicion Engine**: always uses a controlled synthetic benchmark
      dataset to measure Context-Agent lift (recall / precision improvement).
      This is by design — the benchmark must stay constant so the lift score is
      comparable across runs.

    ### `human_feedback` (optional form field)
    Pass analyst notes here when re-triggering after a rejection. The text is
    injected into the Context Agent (biases the Prior Vector) and appended to
    the SAR-generator prompt so the LLM corrects the previous narrative.
    """
    # ── Save the uploaded CSV to a temp file ─────────────────────────────────
    suffix = os.path.splitext(transactions_csv.filename or "upload")[1] or ".csv"
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=suffix)
    try:
        with os.fdopen(tmp_fd, "wb") as tmp_fh:
            shutil.copyfileobj(transactions_csv.file, tmp_fh)

        # ── Run pipeline ─────────────────────────────────────────────────────
        result = run_pipeline(
            human_feedback=human_feedback,
            csv_path=tmp_path,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        # Always clean up the temp file
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    case_id     = result.get("case_id", "CASE-E2E-001")
    audit_data  = _load_json(_latest_audit_path(),                              "Audit trail")
    bundle_data = _load_json(os.path.join(OUT_DIR, "L4_evidence_bundle.json"),  "Evidence bundle")

    return JSONResponse(content={
        "case_id":     case_id,
        "narrative":   result.get("narrative", ""),
        "audit_trail": audit_data,
        "case_bundle": bundle_data,
    })


# ──────────────────────────────────────────────────────────────────────────────
#  ENDPOINT 2 — Evidence Layer (L4 CaseBundle)
# ──────────────────────────────────────────────────────────────────────────────

@app.get(
    "/api/v1/evidence",
    tags=["Outputs"],
    summary="Retrieve the latest Evidence Layer (L4 CaseBundle) as JSON",
)
def get_evidence() -> JSONResponse:
    """
    Returns the **Layer 4 Evidence Bundle** — the aggregated, fact-only
    forensic evidence from the ML Suspicion Engine and the Graph Intelligence
    Engine.

    Does **not** re-run the pipeline. Reads the output of the last successful
    `POST /api/v1/generate_sar` call.

    ### Response shape
    ```json
    {
      "case_id": "CASE-E2E-001",
      "entity_id": "ACC-88392",
      "evidence": [
        {
          "source_layer": "ML_L3",
          "finding_type": "Model_Anomaly_Threshold_Exceeded",
          "forensic_facts": { "z_score": 3.8, "anomaly_score": 0.99, ... },
          "rationale": "Anomaly score of 0.99 exceeds threshold with Z-score 3.8."
        },
        {
          "source_layer": "Graph_L4",
          "finding_type": "Smurfing_Topology_Detected",
          "forensic_facts": { "nodes": 7, "total_volume_usd": 63000.0, ... },
          "rationale": "Subgraph forms a smurfing structure with 7 nodes ..."
        }
      ]
    }
    ```
    """
    bundle_path = os.path.join(OUT_DIR, "L4_evidence_bundle.json")
    return JSONResponse(content=_load_json(bundle_path, "Evidence bundle (L4)"))


# ──────────────────────────────────────────────────────────────────────────────
#  ENDPOINT 3 — Full SAR Report
# ──────────────────────────────────────────────────────────────────────────────

@app.get(
    "/api/v1/sar_report",
    tags=["Outputs"],
    summary="Retrieve the complete generated SAR report",
)
def get_sar_report() -> JSONResponse:
    """
    Returns the **complete SAR Report** from the last pipeline run:

    - `report_meta`      – case ID, generation timestamp, pipeline version
    - `sar_narrative`    – LLM-generated FinCEN-compliant narrative text
    - `evidence_bundle`  – the L4 CaseBundle that drove the narrative
    - `prior_vector`     – the Context Agent's Prior Vector that biased L2 & L3

    Does **not** re-run the pipeline.
    """
    narrative       = _load_text(os.path.join(OUT_DIR, "L5_SAR_Narrative.txt"),    "SAR Narrative (L5)")
    evidence_bundle = _load_json(os.path.join(OUT_DIR, "L4_evidence_bundle.json"), "Evidence bundle (L4)")
    prior_vector    = _load_json(os.path.join(OUT_DIR, "L0_prior_vector.json"),    "Prior Vector (L0)")

    case_id      = evidence_bundle.get("case_id", "CASE-E2E-001")
    generated_at = "unknown"
    try:
        trail = _load_json(_latest_audit_path(), "Audit trail").get("audit_trail", [])
        if trail:
            generated_at = trail[-1].get("timestamp", "unknown")
    except HTTPException:
        pass

    return JSONResponse(content={
        "report_meta": {
            "case_id":          case_id,
            "generated_at_utc": generated_at,
            "pipeline_version": "2.1.0",
        },
        "sar_narrative":   narrative,
        "evidence_bundle": evidence_bundle,
        "prior_vector":    prior_vector,
    })


# ──────────────────────────────────────────────────────────────────────────────
#  ENDPOINT 4 — Full Audit Trail
# ──────────────────────────────────────────────────────────────────────────────

@app.get(
    "/api/v1/audit_trail",
    tags=["Outputs"],
    summary="Retrieve the complete Layer-7 audit trail",
)
def get_audit_trail() -> JSONResponse:
    """
    Returns the **complete Layer-7 Audit Trail** from the last pipeline run —
    an append-only, chronological log of every AI decision and every flagged
    transaction.

    ### What is recorded
    - Layer transition events with all parameters used
    - ML-flagged transactions (suspicion score ≥ 0.85)
    - Graph-topology flagged transactions (from uploaded CSV)
    - Human review decisions (approve / reject + reason)
    - Pipeline re-trigger events with analyst feedback

    Does **not** re-run the pipeline.

    ### Response shape
    ```json
    {
      "case_id": "CASE-E2E-001",
      "audit_trail": [
        { "timestamp": "...", "layer": "SYSTEM",  "action": "AuditTrail Initialized", "details": {...} },
        { "timestamp": "...", "layer": "Ingest_L1","action": "Dataset Loaded",         "details": {...} },
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
    return JSONResponse(content=_load_json(_latest_audit_path(), "Audit trail (L7)"))


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
