"""
api.py  —  SAR Generator ML Service  (v3.0.0)
══════════════════════════════════════════════════════════════════════════════

Key changes vs v2:
  • Lazy pipeline import  — heavy deps (XGBoost, NetworkX, pandas …) are
    imported INSIDE the route handler, not at module load.  This keeps the
    server boot lean and avoids OOM-kills / 502s on low-memory instances.
  • Structured logging    — every error is logged with a full traceback to
    stdout so it appears in Render's log stream.
  • /api/v1/health/detailed — diagnostic endpoint showing memory use, Python
    version, output-file status, and whether the pipeline module imports OK.

Endpoints
─────────────────────────────────────────────────────────────────────────────
  GET   /                            Health ping
  GET   /api/v1/health/detailed      Full diagnostics
  POST  /api/v1/generate_sar         Upload CSV → run 7-layer pipeline
  GET   /api/v1/evidence             Latest L4 Evidence Bundle JSON
  GET   /api/v1/sar_report           Full SAR (narrative + evidence + PV)
  GET   /api/v1/audit_trail          Full L7 audit trail
"""

import glob
import json
import logging
import os
import platform
import shutil
import sys
import tempfile
import traceback
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

# ──────────────────────────────────────────────────────────────────────────────
#  Logging — structured, visible in Render's log stream
# ──────────────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
    stream=sys.stdout,
)
logger = logging.getLogger("sar-api")

# ──────────────────────────────────────────────────────────────────────────────
#  Output directory — resolved WITHOUT importing pipeline at module load
# ──────────────────────────────────────────────────────────────────────────────
THIS_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_DIR  = os.path.join(THIS_DIR, "pipeline_outputs")
os.makedirs(OUT_DIR, exist_ok=True)
logger.info("SAR API starting. OUT_DIR=%s", OUT_DIR)

# ──────────────────────────────────────────────────────────────────────────────
#  App
# ──────────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="SAR Generator ML Service",
    description=(
        "Anti-Money Laundering 7-Layer Detection Pipeline.\n\n"
        "Upload your transaction CSV to `POST /api/v1/generate_sar` to run "
        "the full pipeline and produce a FinCEN-compliant SAR.\n\n"
        "Use `GET /api/v1/health/detailed` to diagnose any deployment issues."
    ),
    version="3.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)


# ──────────────────────────────────────────────────────────────────────────────
#  Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _load_json(path: str, label: str) -> dict:
    if not os.path.exists(path):
        raise HTTPException(
            status_code=404,
            detail=(
                f"{label} not found at '{path}'. "
                "Run POST /api/v1/generate_sar first."
            ),
        )
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception as exc:
        logger.error("Failed to read %s: %s", path, exc)
        raise HTTPException(status_code=500, detail=f"Could not parse {label}: {exc}")


def _load_text(path: str, label: str) -> str:
    if not os.path.exists(path):
        raise HTTPException(
            status_code=404,
            detail=(
                f"{label} not found at '{path}'. "
                "Run POST /api/v1/generate_sar first."
            ),
        )
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return fh.read()
    except Exception as exc:
        logger.error("Failed to read %s: %s", path, exc)
        raise HTTPException(status_code=500, detail=f"Could not read {label}: {exc}")


def _latest_audit_path() -> str:
    pattern    = os.path.join(OUT_DIR, "L7_audit_log_*.json")
    candidates = sorted(glob.glob(pattern), key=os.path.getmtime, reverse=True)
    return candidates[0] if candidates else os.path.join(OUT_DIR, "L7_audit_log_CASE-E2E-001.json")


def _memory_mb() -> Optional[float]:
    """Return current RSS memory in MB (Linux only; None on other platforms)."""
    try:
        import resource
        kb = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        # Linux returns kilobytes, macOS returns bytes
        return round(kb / 1024, 1) if sys.platform == "linux" else round(kb / (1024 * 1024), 1)
    except Exception:
        return None


def _pipeline_import_ok() -> tuple[bool, str]:
    """Try to import the pipeline module; return (ok, message)."""
    try:
        import importlib
        importlib.import_module("pipeline")
        return True, "OK"
    except Exception as exc:
        return False, f"{type(exc).__name__}: {exc}"


# ──────────────────────────────────────────────────────────────────────────────
#  Health check (light)
# ──────────────────────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def health_check():
    """Lightweight health ping — used by Render's health-check probe."""
    return {"status": "ok", "service": "SAR-Generator-API", "version": "3.0.0"}


# ──────────────────────────────────────────────────────────────────────────────
#  Health check (detailed diagnostic)
# ──────────────────────────────────────────────────────────────────────────────

@app.get("/api/v1/health/detailed", tags=["Health"])
def health_detailed():
    """
    Full diagnostic report — use this when the service behaves unexpectedly.

    Returns:
    - Python / platform info
    - Current RSS memory usage
    - Whether all output files from the last run exist
    - Whether the pipeline module can be imported successfully
    """
    output_files = [
        "L0_prior_vector.json",
        "L2_ml_scores.csv",
        "L3_graph_signals.json",
        "L3_graph_features.csv",
        "L4_evidence_bundle.json",
        "L5_SAR_Narrative.txt",
        "L5_SAR_Report.json",
    ]
    audit_candidates = glob.glob(os.path.join(OUT_DIR, "L7_audit_log_*.json"))

    file_status = {
        name: os.path.exists(os.path.join(OUT_DIR, name))
        for name in output_files
    }
    file_status["L7_audit_log (any)"] = len(audit_candidates) > 0

    pip_ok, pip_msg = _pipeline_import_ok()

    return {
        "status":          "ok" if pip_ok else "degraded",
        "version":         "3.0.0",
        "python":          sys.version,
        "platform":        platform.platform(),
        "memory_rss_mb":   _memory_mb(),
        "out_dir":         OUT_DIR,
        "output_files":    file_status,
        "pipeline_import": {"ok": pip_ok, "message": pip_msg},
    }


# ──────────────────────────────────────────────────────────────────────────────
#  ENDPOINT 1 — Generate SAR  (lazy pipeline import lives here)
# ──────────────────────────────────────────────────────────────────────────────

@app.post(
    "/api/v1/generate_sar",
    tags=["Pipeline"],
    summary="Upload a transaction CSV and generate a SAR",
)
async def trigger_pipeline(
    transactions_csv: UploadFile = File(
        ...,
        description=(
            "Institution's transaction CSV. "
            "Required columns: transaction_id, sender_account, "
            "receiver_account, amount. "
            "Drives the Graph Intelligence engine (L3) and the audit log."
        ),
    ),
    human_feedback: Optional[str] = Form(
        default=None,
        description=(
            "Optional analyst notes. Biases the Context Agent's Prior Vector "
            "and is appended to the SAR-generator prompt on re-triggers."
        ),
    ),
):
    """
    Runs all 7 AML layers using the uploaded transaction CSV.

    **Lazy import note:** `pipeline.py` and its heavy dependencies (XGBoost,
    NetworkX, pandas, sklearn) are imported here — inside the request — NOT
    at server startup. This keeps boot memory low and avoids 502 OOM-kills.
    """
    # ── Step 1: import pipeline lazily ───────────────────────────────────────
    logger.info("Request received: generate_sar | feedback=%s | file=%s",
                bool(human_feedback), transactions_csv.filename)
    try:
        from pipeline import run_pipeline  # noqa: PLC0415  (intentional lazy import)
        logger.info("pipeline module imported successfully")
    except Exception as exc:
        tb = traceback.format_exc()
        logger.error("Pipeline import FAILED:\n%s", tb)
        raise HTTPException(
            status_code=500,
            detail={
                "error":     "Pipeline module failed to import",
                "exception": str(exc),
                "traceback": tb,
            },
        )

    # ── Step 2: save uploaded CSV to a temp file ──────────────────────────────
    suffix = os.path.splitext(transactions_csv.filename or "upload")[1] or ".csv"
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=suffix)
    logger.info("Saved upload to temp file: %s", tmp_path)
    try:
        with os.fdopen(tmp_fd, "wb") as tmp_fh:
            shutil.copyfileobj(transactions_csv.file, tmp_fh)

        # ── Step 3: run pipeline ──────────────────────────────────────────────
        logger.info("Starting pipeline run …")
        result = run_pipeline(
            human_feedback=human_feedback,
            csv_path=tmp_path,
        )
        logger.info("Pipeline run complete. case_id=%s", result.get("case_id"))

    except HTTPException:
        raise
    except Exception as exc:
        tb = traceback.format_exc()
        logger.error("Pipeline run FAILED:\n%s", tb)
        raise HTTPException(
            status_code=500,
            detail={
                "error":     "Pipeline execution failed",
                "exception": str(exc),
                "traceback": tb,
            },
        )
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    case_id     = result.get("case_id", "CASE-E2E-001")
    audit_data  = _load_json(_latest_audit_path(),                              "Audit trail")
    bundle_data = _load_json(os.path.join(OUT_DIR, "L4_evidence_bundle.json"),  "Evidence bundle")
    sar_report  = _load_json(os.path.join(OUT_DIR, "L5_SAR_Report.json"),       "SAR Report (L5)")

    logger.info("Returning SAR response for case_id=%s", case_id)
    return JSONResponse(content={
        "case_id":     case_id,
        "narrative":   result.get("narrative", ""),
        "audit_trail": audit_data,
        "case_bundle": result.get("evidence_bundle", bundle_data),
        "sar_report":  sar_report,
        
        # Comprehensive layer outputs
        "context_prior_vector":  result.get("context_prior_vector"),
        "ml_evaluation_metrics": result.get("ml_evaluation_metrics"),
        "graph_intelligence":    result.get("graph_intelligence"),
    })


# ──────────────────────────────────────────────────────────────────────────────
#  ENDPOINT 2 — Evidence Layer
# ──────────────────────────────────────────────────────────────────────────────

@app.get(
    "/api/v1/evidence",
    tags=["Outputs"],
    summary="Latest Evidence Layer (L4 CaseBundle) as JSON",
)
def get_evidence() -> JSONResponse:
    """
    Returns the **Layer 4 Evidence Bundle** — aggregated forensic evidence
    from the ML Suspicion Engine (L2) and the Graph Intelligence Engine (L3).

    Does **not** re-run the pipeline.
    """
    logger.info("GET /api/v1/evidence")
    return JSONResponse(content=_load_json(
        os.path.join(OUT_DIR, "L4_evidence_bundle.json"), "Evidence bundle (L4)"
    ))


# ──────────────────────────────────────────────────────────────────────────────
#  ENDPOINT 3 — Full SAR Report
# ──────────────────────────────────────────────────────────────────────────────

@app.get(
    "/api/v1/sar_report",
    tags=["Outputs"],
    summary="Complete generated SAR report",
)
def get_sar_report() -> JSONResponse:
    """
    Returns the **complete SAR Report** from the last pipeline run:

    - `report_meta`      — case ID, generation timestamp, version
    - `sar_narrative`    — LLM-generated FinCEN narrative text
    - `evidence_bundle`  — the L4 CaseBundle that drove the narrative
    - `prior_vector`     — Context Agent's Prior Vector (biased L2 & L3)

    Does **not** re-run the pipeline.
    """
    logger.info("GET /api/v1/sar_report")
    report_path = os.path.join(OUT_DIR, "L5_SAR_Report.json")
    if os.path.exists(report_path):
        return JSONResponse(content=_load_json(report_path, "SAR Report (L5)"))

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
            "pipeline_version": "3.0.0",
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
    summary="Complete Layer-7 audit trail",
)
def get_audit_trail() -> JSONResponse:
    """
    Returns the **complete Layer-7 Audit Trail** — an append-only,
    chronological log of every AI decision and every flagged transaction.

    Does **not** re-run the pipeline.
    """
    logger.info("GET /api/v1/audit_trail")
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
        reload=False,  # reload=True causes double-import; keep off in production
    )
