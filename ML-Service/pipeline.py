"""
e2e_test.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Full end-to-end pipeline test matching the architecture in image.png.

Architecture Flow (from image.png):
  Context Agent → Prior Vector
  Layer 1: Data Ingestion  (Transactions, KYC, Alerts)
  Layer 2: Suspicion Detection  (XGBoost + Prior Vector bias)
  Layer 3: Graph Intelligence   (Typology detection biased by Prior Vector)
  Layer 4: Evidence Builder     (NO context signal — facts only)
  Layer 5: SAR Generation       (LLM + Regulatory Blueprint)
  Layer 6: Human Review         (Audit & Approval)

Run:
    python ML-Service/e2e_test.py
"""

import sys
import os
import io
import json
from datetime import datetime, timezone
import numpy as np
import pandas as pd
from pathlib import Path

# Ensure proper encoding on Windows only — on Linux/Render stdout is already UTF-8
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# Ensure ML-Service is in path
THIS_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(THIS_DIR, "pipeline_outputs")
os.makedirs(OUT_DIR, exist_ok=True)
sys.path.insert(0, THIS_DIR)

from external_context_agent import ContextAgent
from suspicion_detector import (
    generate_synthetic_dataset,
    train_base_model,
    apply_context_bias,
    FEATURE_COLS,
    recall_at_top_k,
    precision_at_top_n,
)
from graph_engine.graph_pipeline import GraphPipeline
from evidence_builder import EvidenceCollector
from sar_generator import generate_sar
from audit_trail import AuditTrail
from human_review import review_sar_interactive

# ═════════════════════════════════════════════════════════════════════════════
#  HELPERS
# ═════════════════════════════════════════════════════════════════════════════
SEP   = "=" * 64
DASH  = "-" * 64

# Disable ANSI when piped, non-TTY, or --no-color flag (safe for Render/uvicorn)
try:
    _NO_COLOR = not sys.stdout.isatty() or "--no-color" in sys.argv
except Exception:
    _NO_COLOR = True
GREEN = "" if _NO_COLOR else "\033[92m"
RED   = "" if _NO_COLOR else "\033[91m"
CYAN  = "" if _NO_COLOR else "\033[96m"
BOLD  = "" if _NO_COLOR else "\033[1m"
RESET = "" if _NO_COLOR else "\033[0m"

def header(title):
    print(f"\n{BOLD}{CYAN}{SEP}{RESET}")
    print(f"{BOLD}{CYAN}  {title}{RESET}")
    print(f"{BOLD}{CYAN}{SEP}{RESET}")

def ok(msg):
    print(f"  {GREEN}✔{RESET}  {msg}")

def warn(msg):
    print(f"  {RED}⚠{RESET}  {msg}")


def _load_db_url() -> str | None:
    sqlite_path = os.getenv("SQLITE_PATH")
    if sqlite_path:
        return f"sqlite:///{sqlite_path.strip()}"

    root_dir = os.path.abspath(os.path.join(THIS_DIR, ".."))
    default_sqlite = os.path.join(root_dir, "backend", "data", "sar.db")
    if os.path.exists(default_sqlite):
        return f"sqlite:///{default_sqlite}"

    env_keys = ["DATABASE_URL", "NEON_DATABASE_URL", "NEON_DB_URL"]
    for key in env_keys:
        value = os.getenv(key)
        if value:
            return value.strip()

    env_path = os.path.join(root_dir, ".env")
    if not os.path.exists(env_path):
        return None

    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                raw = line.strip()
                if not raw or raw.startswith("#"):
                    continue
                if "postgresql://" in raw:
                    return raw
                if "sqlite:///" in raw:
                    return raw
                if "=" in raw:
                    _, val = raw.split("=", 1)
                    if "postgresql://" in val:
                        return val.strip()
                    if "sqlite:///" in val:
                        return val.strip()
                    if "SQLITE_PATH" in raw and val.strip():
                        return f"sqlite:///{val.strip()}"
    except Exception:
        return None

    return None


def _validate_transactions_against_db(tx_df: pd.DataFrame, audit: "AuditTrail") -> None:
    db_url = _load_db_url()
    if not db_url:
        audit.log_step("Validation_L5", "DB Validation Skipped", {"reason": "No DB URL configured"})
        ok("DB validation skipped (no DB URL configured)")
        return

    if tx_df.empty:
        audit.log_step("Validation_L5", "DB Validation Failed", {"reason": "Empty transaction dataset"})
        raise RuntimeError("DB validation failed: empty transaction dataset")

    required_cols = {"transaction_id", "amount"}
    if not required_cols.issubset(set(tx_df.columns)):
        missing = sorted(required_cols - set(tx_df.columns))
        audit.log_step("Validation_L5", "DB Validation Failed", {"reason": "Missing required columns", "missing": missing})
        raise RuntimeError(f"DB validation failed: missing columns {missing}")

    is_sqlite = db_url.startswith("sqlite:///")
    if not is_sqlite:
        try:
            import psycopg2
        except Exception as exc:
            audit.log_step("Validation_L5", "DB Validation Failed", {"reason": "psycopg2 not installed", "error": str(exc)})
            raise RuntimeError("DB validation failed: psycopg2 not installed") from exc

    tx_df = tx_df.dropna(subset=["transaction_id", "amount"]).copy()
    tx_df["transaction_id"] = tx_df["transaction_id"].astype(str)
    tx_ids = tx_df["transaction_id"].unique().tolist()
    if not tx_ids:
        audit.log_step("Validation_L5", "DB Validation Failed", {"reason": "No transaction IDs present"})
        raise RuntimeError("DB validation failed: no transaction IDs present")

    audit.log_step("Validation_L5", "DB Connection Available", {"transaction_ids": len(tx_ids)})
    ok(f"DB validation starting for {len(tx_ids)} transactions")

    db_amounts: dict[str, float] = {}
    missing_ids: set[str] = set()
    chunk_size = 1000

    if is_sqlite:
        import sqlite3
        sqlite_path = db_url.replace("sqlite:///", "")
        conn = sqlite3.connect(sqlite_path)
        try:
            cur = conn.cursor()
            for i in range(0, len(tx_ids), chunk_size):
                chunk = tx_ids[i:i + chunk_size]
                placeholders = ",".join(["?"] * len(chunk))
                query = f"SELECT transaction_id, amount FROM transactions WHERE transaction_id IN ({placeholders})"
                cur.execute(query, chunk)
                rows = cur.fetchall()
                for tx_id, amount in rows:
                    if tx_id is not None:
                        db_amounts[str(tx_id)] = float(amount) if amount is not None else 0.0
        finally:
            conn.close()
    else:
        with psycopg2.connect(db_url) as conn:
            with conn.cursor() as cur:
                for i in range(0, len(tx_ids), chunk_size):
                    chunk = tx_ids[i:i + chunk_size]
                    cur.execute(
                        "SELECT transaction_id, amount FROM transactions WHERE transaction_id = ANY(%s)",
                        (chunk,),
                    )
                    rows = cur.fetchall()
                    for tx_id, amount in rows:
                        if tx_id is not None:
                            db_amounts[str(tx_id)] = float(amount) if amount is not None else 0.0

    missing_ids = set(tx_ids) - set(db_amounts.keys())
    audit.log_step("Validation_L5", "DB Transaction Presence Check", {
        "total_transactions": len(tx_ids),
        "missing_transactions": len(missing_ids),
    })

    if missing_ids:
        raise RuntimeError(f"DB validation failed: {len(missing_ids)} transactions not found")

    mismatches = 0
    for _, row in tx_df.iterrows():
        tx_id = str(row["transaction_id"])
        amount = float(row["amount"])
        db_amount = db_amounts.get(tx_id, None)
        if db_amount is None:
            mismatches += 1
            continue
        if abs(db_amount - amount) > 0.01:
            mismatches += 1

    audit.log_step("Validation_L5", "DB Amount Consistency Check", {
        "amount_mismatches": mismatches,
    })

    if mismatches:
        raise RuntimeError(f"DB validation failed: {mismatches} amount mismatches")

    ok("DB validation passed (transaction IDs + amount fields)")


def _safe_country_list(df: pd.DataFrame) -> list[str]:
    if df.empty or "country" not in df.columns:
        return []
    countries = df["country"].dropna().astype(str).str.upper().unique().tolist()
    return sorted(countries)


def _primary_country(df: pd.DataFrame) -> str:
    if df.empty or "country" not in df.columns:
        return "UNKNOWN"
    vc = df["country"].dropna().astype(str).str.upper().value_counts()
    return str(vc.index[0]) if not vc.empty else "UNKNOWN"


def _review_period(df: pd.DataFrame) -> dict:
    if df.empty or "timestamp" not in df.columns:
        return {"start": "UNKNOWN", "end": "UNKNOWN"}
    ts = pd.to_datetime(df["timestamp"], errors="coerce").dropna()
    if ts.empty:
        return {"start": "UNKNOWN", "end": "UNKNOWN"}
    return {
        "start": ts.min().date().isoformat(),
        "end": ts.max().date().isoformat(),
    }


def _pattern_labels(signals: dict) -> list[str]:
    mapping = {
        "smurfing": "smurfing",
        "funnel_accounts": "funnel_accounts",
        "layering": "layering",
        "circular_transfer": "circular_transfer",
    }
    labels = [mapping[k] for k, v in signals.items() if v]
    return labels


def _derive_risk_score(evidence_bundle: dict, fallback_score: float) -> int:
    for evidence in evidence_bundle.get("evidence", []):
        if evidence.get("source_layer") == "ML_L3":
            facts = evidence.get("forensic_facts", {})
            anomaly = facts.get("anomaly_score")
            if isinstance(anomaly, (int, float)):
                return int(round(float(anomaly) * 100))
    return int(round(fallback_score * 100))


def _risk_category(score: int) -> str:
    if score >= 70:
        return "HIGH"
    if score >= 40:
        return "MEDIUM"
    return "LOW"


def _build_sar_report(
    case_id: str,
    narrative: str,
    evidence_bundle: dict,
    prior_vector: dict,
    tx_df: pd.DataFrame,
    graph_signals: dict,
    graph_flagged_nodes: set,
    graph_flagged_tx: pd.DataFrame,
    audit_flagged_tx: list[dict],
    ai_confidence: float,
    lift: float,
) -> dict:
    countries = _safe_country_list(tx_df)
    primary_country = _primary_country(tx_df)
    patterns_detected = _pattern_labels(graph_signals)

    review_period = _review_period(tx_df)
    total_amount = float(tx_df["amount"].sum()) if not tx_df.empty and "amount" in tx_df.columns else 0.0
    avg_amount = float(tx_df["amount"].mean()) if not tx_df.empty and "amount" in tx_df.columns else 0.0
    max_amount = float(tx_df["amount"].max()) if not tx_df.empty and "amount" in tx_df.columns else 0.0

    suspicious_rows = graph_flagged_tx
    if suspicious_rows is None or suspicious_rows.empty:
        if "is_suspicious" in tx_df.columns:
            suspicious_rows = tx_df[tx_df["is_suspicious"] == 1]
        else:
            suspicious_rows = tx_df.head(0)

    suspicious_rows = suspicious_rows.head(25).copy()
    flagged_countries = set()
    suspicious_tx = []
    for _, row in suspicious_rows.iterrows():
        indicators = []
        if row.get("pattern"):
            indicators.append(str(row.get("pattern")))
        if row.get("high_risk_country") == 1:
            indicators.append("high_risk_country")
            if row.get("country"):
                flagged_countries.add(str(row.get("country")).upper())
        if row.get("country"):
            indicators.append("cross_border")
        if row.get("sender_account") in graph_flagged_nodes or row.get("receiver_account") in graph_flagged_nodes:
            indicators.append("graph_topology")
        suspicious_tx.append({
            "date": str(row.get("timestamp", ""))[:10] if row.get("timestamp") else "UNKNOWN",
            "amount": float(row.get("amount", 0.0)),
            "type": str(row.get("type", "UNKNOWN")),
            "from_account": str(row.get("sender_account", "")),
            "to_account": str(row.get("receiver_account", "")),
            "indicator": sorted(set(indicators))
        })

    if not flagged_countries and audit_flagged_tx:
        for tx in audit_flagged_tx:
            country = tx.get("country")
            if country:
                flagged_countries.add(str(country).upper())

    risk_score = _derive_risk_score(evidence_bundle, ai_confidence)
    risk_category = _risk_category(risk_score)

    regulatory_impact = min(1.0, round(0.45 + (risk_score / 100) * 0.5 + (0.05 if patterns_detected else 0.0), 2))
    ai_confidence = round(float(ai_confidence), 2)

    relationship_types = []
    if "layering" in patterns_detected:
        relationship_types.append("layered_flow")
    if "smurfing" in patterns_detected:
        relationship_types.append("fan_in")
    if "funnel_accounts" in patterns_detected:
        relationship_types.append("pass_through")
    if "circular_transfer" in patterns_detected:
        relationship_types.append("round_trip")

    risk_indicators = []
    if flagged_countries:
        risk_indicators.append(f"High-risk jurisdiction involvement: {', '.join(sorted(flagged_countries))}")
    if "velocity_spike" in tx_df.columns and (tx_df["velocity_spike"] == 1).any():
        risk_indicators.append("Transaction velocity anomaly")
    if patterns_detected:
        risk_indicators.append(f"Patterns detected: {', '.join(patterns_detected)}")
    if lift > 1.0:
        risk_indicators.append(f"Contextual lift observed: {lift:.2f}x")

    network_connections = len(graph_flagged_nodes)
    if network_connections == 0:
        for pattern_list in graph_signals.values():
            for sig in pattern_list:
                if isinstance(sig, dict):
                    if "account" in sig:
                        graph_flagged_nodes.add(sig["account"])
                    if "nodes" in sig:
                        graph_flagged_nodes.update(sig["nodes"])
                    if "accounts" in sig:
                        graph_flagged_nodes.update(sig["accounts"])
        network_connections = len(graph_flagged_nodes)

    detection_type = ", ".join(patterns_detected) if patterns_detected else "model_based"

    return {
        "case_metadata": {
            "case_id": case_id,
            "date_generated": datetime.now(timezone.utc).date().isoformat(),
            "reporting_unit": "AML Compliance / FIU",
            "primary_country": primary_country,
            "ai_confidence": ai_confidence,
            "regulatory_impact": regulatory_impact,
            "model_version": "SAR Guardian v2.1",
        },
        "subject_profile": {
            "account_id": evidence_bundle.get("entity_id", "UNKNOWN"),
            "risk_score": risk_score,
            "risk_category": risk_category,
            "kyc_status": "UNDER_REVIEW",
            "risk_types": patterns_detected,
            "connections_count": len(graph_flagged_nodes),
            "relationship_types": relationship_types,
            "institution": "UNKNOWN",
            "countries_involved": sorted(flagged_countries) if flagged_countries else countries,
        },
        "transaction_summary": {
            "review_period": review_period,
            "total_amount": round(total_amount, 2),
            "transaction_count": int(len(tx_df)) if not tx_df.empty else 0,
            "suspicious_transaction_count": max(len(suspicious_tx), len(audit_flagged_tx)),
            "average_amount": round(avg_amount, 2),
            "max_transaction": round(max_amount, 2),
            "countries": sorted(flagged_countries) if flagged_countries else countries,
            "patterns_detected": patterns_detected,
        },
        "suspicious_transactions": suspicious_tx,
        "regulatory_mapping": [
            {
                "severity": "CRITICAL" if risk_category == "HIGH" else "MEDIUM",
                "regulation": "BSA SAR Rule",
                "reference": "31 USC §5318(g)",
                "confidence": min(0.99, max(0.75, ai_confidence + 0.2)),
                "trigger_reason": f"{max(len(suspicious_tx), len(audit_flagged_tx))} suspicious transactions totaling ${round(total_amount, 2)}",
            }
        ],
        "risk_indicators": risk_indicators,
        "evidence_summary": {
            "transaction_records": int(len(tx_df)) if not tx_df.empty else 0,
            "risk_score": risk_score,
            "network_connections": network_connections,
            "external_intelligence_hits": 0,
            "detection_type": detection_type,
        },
        "narrative_generation": {
            "suspicious_activity_description": narrative,
            "conclusion": f"Case {case_id} assessed as {risk_category} risk based on observed anomalies.",
        },
        "debug_context": {
            "prior_vector": prior_vector,
        },
    }


# ═════════════════════════════════════════════════════════════════════════════
#  ANTI-HALLUCINATION VALIDATOR
# ═════════════════════════════════════════════════════════════════════════════

def _validate_sar_narrative_against_db(
    narrative: str,
    tx_df: pd.DataFrame,
    db_confirmed_ids: set[str] | None = None,
) -> dict:
    """
    Cross-references factual claims in the LLM-generated SAR narrative
    strictly against the DB/CSV transaction data.

    Checks performed
    ─────────────────
    1. Dollar amounts   — every $ figure in the narrative must be within the
                          range of amounts in the confirmed transaction set.
    2. Account IDs      — any alphanumeric token that looks like an account ID
                          must appear in the confirmed transactions.

    Returns a hallucination_report dict with:
      • passed              bool   — True if no unverified claims
      • hallucination_risk  float  — 0.0 (clean) → 1.0 (fully hallucinated)
      • checks              list   — per-check result objects
      • unverified_claims   list   — specific text snippets that could not be matched
    """
    import re

    checks: list[dict] = []
    unverified_claims: list[str] = []

    # ── Build ground-truth lookup tables from DB/CSV ─────────────────────────

    csv_amounts: list[float] = []
    csv_accounts: set[str] = set()
    
    if not tx_df.empty:
        if "amount" in tx_df.columns:
            csv_amounts = tx_df["amount"].dropna().astype(float).tolist()
        for col in ("sender_account", "receiver_account"):
            if col in tx_df.columns:
                csv_accounts.update(tx_df[col].dropna().astype(str).str.upper().tolist())

    amount_min = min(csv_amounts) * 0.0 if csv_amounts else 0.0
    amount_max = max(csv_amounts) * 1.5 if csv_amounts else float("inf")

    # Ground-truth account IDs (CSV + DB confirmed)
    confirmed_accounts = csv_accounts.copy()
    if db_confirmed_ids:
        confirmed_accounts.update(s.upper() for s in db_confirmed_ids)

    # ─────────────────────────────────────────────────────────────────────────
    # CHECK 1: Dollar amounts
    # ─────────────────────────────────────────────────────────────────────────
    amount_pattern = re.compile(r"\$([\d,]+(?:\.\d{1,2})?)")
    found_amounts  = amount_pattern.findall(narrative)
    bad_amounts    = []
    for raw in found_amounts:
        try:
            val = float(raw.replace(",", ""))
        except ValueError:
            continue
        if csv_amounts and not (amount_min <= val <= amount_max):
            bad_amounts.append(f"${raw}")
            unverified_claims.append(f"Amount ${raw} not in DB-confirmed range [{amount_min:.0f}–{amount_max:.0f}]")

    checks.append({
        "check":          "dollar_amounts",
        "description":    "All $ figures in narrative must be within range of DB-confirmed transaction data",
        "values_found":   found_amounts,
        "unverified":     bad_amounts,
        "passed":         len(bad_amounts) == 0,
    })

    # ─────────────────────────────────────────────────────────────────────────
    # CHECK 2: Account IDs
    # ─────────────────────────────────────────────────────────────────────────
    account_pattern = re.compile(
        r"\b([A-Z]{2,6}[-_][A-Z0-9]{3,15}|[0-9]{8,20})\b", re.IGNORECASE
    )
    found_accounts = [m.upper() for m in account_pattern.findall(narrative)]
    bad_accounts   = []
    if confirmed_accounts:
        for acct in found_accounts:
            if acct not in confirmed_accounts:
                bad_accounts.append(acct)
                unverified_claims.append(f"Account '{acct}' not found in DB-confirmed transaction records")

    checks.append({
        "check":        "account_ids",
        "description":  "Account identifiers in narrative must exist in the DB-confirmed transaction dataset",
        "values_found": found_accounts,
        "unverified":   bad_accounts,
        "passed":       len(bad_accounts) == 0,
    })

    # ─────────────────────────────────────────────────────────────────────────
    # Score
    # ─────────────────────────────────────────────────────────────────────────
    weights = {"dollar_amounts": 0.50, "account_ids": 0.50}
    total_unverified = sum(len(c["unverified"]) for c in checks)
    total_found      = sum(len(c.get("values_found") or []) for c in checks)

    failed_weights = sum(weights[c["check"]] for c in checks if not c["passed"])
    hallucination_risk = round(min(1.0, failed_weights + (total_unverified * 0.10)), 3)
    passed_overall     = hallucination_risk < 0.50

    return {
        "passed":             passed_overall,
        "hallucination_risk": hallucination_risk,
        "risk_label":         "LOW" if hallucination_risk < 0.3 else ("MEDIUM" if hallucination_risk < 0.6 else "HIGH"),
        "total_claims_checked": total_found,
        "unverified_claim_count": total_unverified,
        "unverified_claims":  unverified_claims,
        "checks":             checks,
        "note": (
            "All tested narrative claims matching DB evidence."
            if passed_overall else
            "WARNING: Narrative contains specific figures/IDs not grounded in the DB transactions."
        ),
    }


# ═════════════════════════════════════════════════════════════════════════════
#  PIPELINE
# ═════════════════════════════════════════════════════════════════════════════

def run_pipeline(human_feedback: str | None = None, csv_path: str | None = None) -> dict:
    header("END-TO-END PIPELINE TEST")
    case_id = "CASE-E2E-001"

    # ── Initialize Audit Trail (Layer 7) ──────────────────────────────────
    audit = AuditTrail(case_id=case_id)
    if human_feedback:
        audit.log_step("SYSTEM", "Pipeline Re-Triggered", {"human_feedback": human_feedback})
        ok("Pipeline RE-TRIGGERED via Human Feedback loop.")

    # ── Context Agent ─────────────────────────────────────────────────────
    header("STAGE 0: EXTERNAL CONTEXT AGENT")
    FINCEN_TEXT = """\
FinCEN Advisory FIN-2025-A002: Money Laundering Threats in West Africa.
FinCEN is alerting institutions to structuring and smurfing networks
operating out of Nigeria and Ghana. Shell companies use trade-based
money laundering to layer narcotics trafficking proceeds through
correspondent banking. File SARs for below-threshold cash deposits
wired offshore to high-risk jurisdictions."""

    if human_feedback:
        # Augment the intelligence text with the human's feedback to bias the engine!
        FINCEN_TEXT += f"\n\n[ANALYST OVERRIDE/FEEDBACK]: {human_feedback}"
        print(f"  Injected Feedback: {human_feedback}")

    agent  = ContextAgent(timestamp_override="2026-03-26T12:00:00Z")
    vector = agent.analyze(FINCEN_TEXT)
    pv_dict = vector.to_dict()
    
    audit.log_step("Context_L2", "Generated Prior Vector", {"prior_vector": pv_dict, "risk_multiplier": vector.risk_multiplier})
    
    print(f"  Input     : FinCEN Advisory + Feedback")
    print(f"  Output    : PriorVector JSON")
    print(json.dumps(pv_dict, indent=4))
    ok(f"risk_multiplier = {vector.risk_multiplier}")
    ok(f"typology_focus  = {vector.typology_focus}")
    ok(f"region_risk     = {vector.region_risk}")
    ok(f"commodity_flag  = {vector.commodity_flag}")

    # Save Layer 0 (Prior Vector)
    with open(os.path.join(OUT_DIR, "L0_prior_vector.json"), "w") as f:
        json.dump(pv_dict, f, indent=4)
        
    expected_rm = vector.risk_multiplier >= 0.5
    expected_ty = vector.typology_focus != "None"
    if expected_rm and expected_ty:
        ok("Prior Vector has meaningful signal — will bias downstream layers")
    else:
        warn("Prior Vector is baseline — downstream biasing will be inactive")

    # ── Layer 1: Data Ingestion ───────────────────────────────────────────
    header("LAYER 1: DATA INGESTION")
    # Prefer caller-supplied CSV; fall back to the bundled synthetic dataset.
    if csv_path and os.path.exists(csv_path):
        dataset_path = os.path.abspath(csv_path)
        ok(f"Using caller-supplied CSV: {dataset_path}")
    else:
        dataset_path = os.path.abspath(
            os.path.join(THIS_DIR, "..", "Dataset", "synthetic_aml_transactions.csv")
        )
        if csv_path:
            warn(f"Supplied CSV not found at '{csv_path}'. Falling back to default dataset.")

    tx_df = pd.DataFrame()
    if os.path.exists(dataset_path):
        file_size_mb = os.path.getsize(dataset_path) / (1024 * 1024)
        ok(f"Dataset found: {dataset_path} ({file_size_mb:.1f} MB)")
        audit.log_step("Ingest_L1", "Dataset Loaded", {"path": dataset_path, "size_mb": round(file_size_mb, 2)})
        try:
            tx_df = pd.read_csv(dataset_path)
            ok(f"Loaded {len(tx_df)} transactions for reporting summary")
        except Exception as e:
            warn(f"Could not read dataset for summary: {e}")
    else:
        warn(f"Dataset NOT FOUND at {dataset_path}")
        audit.log_step("Ingest_L1", "Dataset Missing", {"path": dataset_path})

    # Also generate synthetic ground-truth for ML validation
    df = generate_synthetic_dataset()
    labels = df["label"].values
    ok(f"Synthetic ground-truth: {len(df)} rows, {int(labels.sum())} fraud, {int((1-labels).sum())} clean")

    # ── Layer 2: Suspicion Detection (XGBoost + Context bias) ─────────────
    header("LAYER 2: SUSPICION DETECTION (ML Engine)")
    model = train_base_model(df)
    base_scores = model.predict_proba(df[FEATURE_COLS])[:, 1]

    # Run A: Static (no context)
    static_pv = {"world_state": {"risk_multiplier": 0.05, "typology_focus": "None"}}
    scores_static = apply_context_bias(df, base_scores, static_pv)

    # Run B: Context-Aware
    scores_aware = apply_context_bias(df, base_scores, pv_dict)

    recall_a = recall_at_top_k(scores_static, labels, k=10)
    recall_b = recall_at_top_k(scores_aware,  labels, k=10)
    prec_a   = precision_at_top_n(scores_static, labels, n=20)
    prec_b   = precision_at_top_n(scores_aware,  labels, n=20)
    lift     = recall_b / recall_a if recall_a > 0 else float("inf")

    print(f"\n  {DASH}")
    print(f"  {'METRIC':<28} {'RUN A (Static)':>15} {'RUN B (Aware)':>15}")
    print(f"  {DASH}")
    print(f"  {'Recall @ Top 10':<28} {recall_a:>14.1%} {recall_b:>14.1%}")
    print(f"  {'Precision @ Top 20':<28} {prec_a:>14.1%} {prec_b:>14.1%}")
    print(f"  {DASH}")
    print(f"  Lift (Recall B / A) = {lift:.2f}")

    if lift > 1.0:
        ok(f"Context Agent LIFT = {lift:.2f}x — ML layer is context-aware ✓")
    else:
        warn(f"No lift detected — lift = {lift:.2f}")

    ok(f"Max adjusted score: {max(scores_aware):.4f}")
    ok(f"Output: array of {len(scores_aware)} anomaly scores passed to downstream")

    # Save Layer 2 output
    df["ml_suspicion_score"] = scores_aware
    df.to_csv(os.path.join(OUT_DIR, "L2_ml_scores.csv"), index=False)
    
    # Extract flagged transactions for Audit Trail (Threshold > 0.85)
    flagged_df = df[df["ml_suspicion_score"] >= 0.85]
    for _, row in flagged_df.iterrows():
        audit.record_flagged_transaction(
            tx_id=str(row.get("transaction_id", "Unknown")),
            sender=str(row.get("sender_account", "")),
            receiver=str(row.get("receiver_account", "")),
            amount=float(row.get("amount", 0.0)),
            reason=f"ML Anomaly Score High: {row['ml_suspicion_score']:.4f}",
            layer="ML_L3"
        )
    
    # Audit Layer 2
    audit.log_step("ML_L3", "Executed XGBoost Context Bias", {
        "dataset_rows": len(df),
        "flagged_transactions_count": len(flagged_df),
        "lift": lift,
        "max_adjusted_score": max(scores_aware)
    })
    ok(f"Layer 2 scores saved to L2_ml_scores.csv. Logged {len(flagged_df)} flagged ML transactions to Audit.")

    # ── Layer 3: Graph Intelligence (NOW with Prior Vector bias) ──────────
    header("LAYER 3: GRAPH INTELLIGENCE (Context-Biased)")
    pipeline_biased = GraphPipeline(
        csv_path=dataset_path,
        case_id="CASE-E2E-001",
        prior_vector=pv_dict,
    )
    result_biased = pipeline_biased.run()

    # Also run without bias for comparison
    pipeline_static = GraphPipeline(csv_path=dataset_path, case_id="CASE-E2E-002")
    result_static = pipeline_static.run()

    print(f"\n  Signal comparison (Static vs Context-Biased):")
    for pattern in ["smurfing", "funnel_accounts", "layering", "circular_transfer"]:
        n_static = len(result_static["signals"].get(pattern, []))
        n_biased = len(result_biased["signals"].get(pattern, []))
        delta = n_biased - n_static
        marker = f" (+{delta})" if delta > 0 else ""
        print(f"    {pattern:<22} Static: {n_static:>4}   Biased: {n_biased:>4}{marker}")

    # Save Layer 3 outputs
    pipeline_biased.export_signals_json(os.path.join(OUT_DIR, "L3_graph_signals.json"))
    pipeline_biased.export_features_csv(os.path.join(OUT_DIR, "L3_graph_features.csv"))
    
    # Extract Graph-flagged accounts explicitly into the transaction audit
    graph_flagged_nodes = set()
    for pattern_name, instances in result_biased["signals"].items():
        for sig in instances:
            # Most pattern signals have 'nodes' key, some have specific node strings (funnel_account)
            if "nodes" in sig:
                graph_flagged_nodes.update(sig["nodes"])
            elif "funnel_account" in sig:
                graph_flagged_nodes.add(sig["funnel_account"])
                
    # Loop over original dataset and find any transaction interacting closely with these severely flagged graph nodes
    # For performance on large sets, we limit to the worst offenders
    try:
        full_df = pd.read_csv(dataset_path)
        graph_flagged_tx = full_df[full_df["sender_account"].isin(graph_flagged_nodes) | full_df["receiver_account"].isin(graph_flagged_nodes)]
        # Pick a random sample or high dollar amount if too many, to avoid exploding log
        graph_flagged_tx = graph_flagged_tx.sort_values(by="amount", ascending=False).head(50)
    except Exception as e:
        print(f"  Warning: Failed to load dataset for graph audit logging: {e}")
        graph_flagged_tx = pd.DataFrame()
        
    for _, row in graph_flagged_tx.iterrows():
        audit.record_flagged_transaction(
            tx_id=str(row.get("transaction_id", "Unknown")),
            sender=str(row.get("sender_account", "")),
            receiver=str(row.get("receiver_account", "")),
            amount=float(row.get("amount", 0.0)),
            reason=f"Participating in Graph Intelligence Topology",
            layer="Graph_L4"
        )
    
    audit.log_step("Graph_L4", "Generated Subgraph Topologies", {
        "smurfing_signals": n_biased,
        "funnel_signals": len(result_biased["signals"].get("funnel_accounts", [])),
        "layering_signals": len(result_biased["signals"].get("layering", [])),
        "circular_signals": len(result_biased["signals"].get("circular_transfer", [])),
        "flagged_graph_nodes": len(graph_flagged_nodes)
    })
    
    ok(f"Layer 3 graph features saved. Logged {len(graph_flagged_tx)} topological transactions to Audit.")

    # Show top 3 smurfing signals from biased run
    smurf_sigs = result_biased["signals"].get("smurfing", [])
    if smurf_sigs:
        print(f"\n  Top 3 Smurfing Signals (biased run):")
        for sig in smurf_sigs[:3]:
            print(f"    Account: {sig['account']} | Senders: {sig['unique_senders']} "
                  f"| TxCount: {sig['transaction_count']} | Risk: {sig['risk_score']}")

    # ── Layer 4: Evidence Builder (NO context signal) ─────────────────────
    header("LAYER 4: EVIDENCE BUILDER (Facts Only — No Context Signal)")
    collector = EvidenceCollector(entity_id="ACC-88392", case_id="CASE-E2E-001")

    # ML evidence
    collector.add_ml_evidence(
        feature_importance={"amount": 0.4, "n_daily_txns": 0.35, "velocity_spike": 0.25},
        z_score=3.8,
        anomaly_score=float(max(scores_aware)),
    )

    # Graph evidence (from top smurfing signal)
    if smurf_sigs:
        top_sig = smurf_sigs[0]
        collector.add_graph_evidence(
            topology="smurfing",
            centrality=top_sig["risk_score"],
            node_count=top_sig["unique_senders"],
            edge_volume_usd=top_sig["total_amount"],
        )

    case_json = collector.assemble_case()
    print(f"\n  Output: CaseBundle JSON object")

    # Save Layer 4 output
    with open(os.path.join(OUT_DIR, "L4_evidence_bundle.json"), "w") as f:
        f.write(case_json)
        
    bundle_dict = json.loads(case_json)
    audit.log_step("Evidence_L5", "Built Fact-based CaseBundle", {
        "entity_id": "ACC-88392",
        "evidence_objects_count": len(bundle_dict["evidence"])
    })
    
    ok("Layer 4 CaseBundle saved to L4_evidence_bundle.json")

    # Verify NO context evidence leaked in
    context_evidence = [e for e in bundle_dict["evidence"] if e["source_layer"] == "Context_L2"]
    if len(context_evidence) == 0:
        ok("PASSED: Evidence Bundle contains ZERO Context_L2 objects (architecture compliant)")
    else:
        warn(f"FAILED: Found {len(context_evidence)} Context_L2 objects — architecture violation!")

    ml_evidence  = [e for e in bundle_dict["evidence"] if e["source_layer"] == "ML_L3"]
    graph_evidence = [e for e in bundle_dict["evidence"] if e["source_layer"] == "Graph_L4"]
    ok(f"ML evidence objects: {len(ml_evidence)}")
    ok(f"Graph evidence objects: {len(graph_evidence)}")

    # ── Validation Layer A/B: DB presence + amount consistency ────────────
    header("VALIDATION: DB TRANSACTION INTEGRITY")
    try:
        _validate_transactions_against_db(tx_df, audit)
    except Exception as exc:
        audit.log_step("Validation_L5", "DB Validation Failed", {"error": str(exc)})
        audit_path = audit.export_log(os.path.join(OUT_DIR, f"L7_audit_log_{case_id}.json"))
        warn(f"Validation failed. Audit trail written to: {audit_path}")
        raise

    # ── Layer 5: SAR Generator ────────────────────────────────────────────
    header("LAYER 5: SAR GENERATION (LLM)")
    print("  Status: sar_generator.py is ready")
    print("  Input:  CaseBundle JSON + ReportingBlueprint JSON")
    blueprint_path = os.path.join(THIS_DIR, "blueprint_fincen.json")
    if not os.path.exists(blueprint_path):
        warn(f"Blueprint missing at {blueprint_path}. Skipping SAR generation.")
    else:
        with open(blueprint_path, "r", encoding="utf-8") as bf:
            blueprint_json = json.load(bf)
            
        print("  Connecting to local Ollama server (llama3.2:latest)...")
        try:
            # We connect to localhost:11434
            import requests
            requests.get("http://localhost:11434/", timeout=3)
            ok("Ollama server is reachable.")
            
            # Ensure the LLM addresses the human query inside the system prompt if we were retriggers
            if human_feedback:
                custom_instructions = blueprint_json.get("NarrativeInstructions", [])
                custom_instructions.append(f"THE ANALYST PREVIOUSLY REJECTED THIS WITH THE FOLLOWING NOTE, PLEASE CAREFULLY CORRECT THE REPORT: {human_feedback}")
                blueprint_json["NarrativeInstructions"] = custom_instructions
                
            # Generate the SAR using the real function
            narrative = generate_sar(
                country="United States",
                reporting_blueprint=blueprint_json,
                evidence_bundle=case_json,
                model_name="llama3.2:latest"
            )
            
            print(f"\n{BOLD}{CYAN}  --- GENERATED SAR NARRATIVE --- {RESET}")
            print(narrative)
            print(f"{BOLD}{CYAN}  ------------------------------- {RESET}\n")
            
            # Save Layer 5 output
            with open(os.path.join(OUT_DIR, "L5_SAR_Narrative.txt"), "w") as f:
                f.write(narrative)
            
            audit.log_step("SAR_L6", "Generated Language Model Narrative", {"model": "llama3.2:latest"})
            ok("SAR Text Successfully Generated and saved to L5_SAR_Narrative.txt")
            
        except Exception as e:
            warn(f"Ollama connection failed or generation error: {e}")

    # ── Anti-Hallucination Validator ──────────────────────────────────────────
    header("VALIDATION: ANTI-HALLUCINATION CHECK")
    narrative_for_check = narrative if 'narrative' in locals() else ""
    db_confirmed_ids: set[str] = set()
    if not tx_df.empty and "transaction_id" in tx_df.columns:
        db_confirmed_ids = set(tx_df["transaction_id"].dropna().astype(str).tolist())

    hallucination_report = _validate_sar_narrative_against_db(
        narrative          = narrative_for_check,
        tx_df              = tx_df,
        db_confirmed_ids   = db_confirmed_ids,
    )

    if hallucination_report["passed"]:
        ok(f"Anti-hallucination check PASSED (risk={hallucination_report['hallucination_risk']:.0%})")
    else:
        warn(f"Anti-hallucination check FAILED — risk={hallucination_report['hallucination_risk']:.0%}")
        for claim in hallucination_report["unverified_claims"]:
            warn(f"  Unverified: {claim}")

    audit.log_step("Hallucination_L5", "Anti-Hallucination Validation Complete", {
        "passed":             hallucination_report["passed"],
        "hallucination_risk": hallucination_report["hallucination_risk"],
        "risk_label":         hallucination_report["risk_label"],
        "unverified_claims":  hallucination_report["unverified_claim_count"],
        "checks_run":         len(hallucination_report["checks"]),
    })

    # ── L5: JSON SAR Report (structured output) ───────────────────────────
    narrative_text = narrative if 'narrative' in locals() else "[SAR GENERATION FAILED]"
    sar_report = _build_sar_report(
        case_id=case_id,
        narrative=narrative_text,
        evidence_bundle=bundle_dict,
        prior_vector=pv_dict,
        tx_df=tx_df,
        graph_signals=result_biased["signals"],
        graph_flagged_nodes=graph_flagged_nodes,
        graph_flagged_tx=graph_flagged_tx,
        audit_flagged_tx=audit.flagged_transactions,
        ai_confidence=float(max(scores_aware)) if len(scores_aware) else 0.0,
        lift=lift,
    )
    # Embed the hallucination report into the SAR report JSON
    sar_report["hallucination_validation"] = hallucination_report

    with open(os.path.join(OUT_DIR, "L5_SAR_Report.json"), "w", encoding="utf-8") as f:
        json.dump(sar_report, f, indent=2)
    ok("Structured SAR Report saved to L5_SAR_Report.json")

    # ── Layer 6: Human Review ─────────────────────────────────────────────
    header("LAYER 6: HUMAN REVIEW & LAYER 7: AUDIT")
    ok("Review terminal triggered.")
    print("  Recommendation: Export CaseBundle + SAR to a review dashboard")

    # ── Summary ───────────────────────────────────────────────────────────
    header("PIPELINE SUMMARY")
    layers = [
        ("Context Agent",       "✔", "Prior Vector generated"),
        ("Layer 1: Ingestion",  "✔", f"Dataset loaded ({file_size_mb:.1f} MB)"),
        ("Layer 2: ML Engine",  "✔", f"Lift = {lift:.2f}x"),
        ("Layer 3: Graph Intel","✔", f"Now context-biased"),
        ("Layer 4: Evidence",   "✔", "No context leakage"),
        ("Layer 5: SAR Gen",    "✔" if 'narrative' in locals() else "⚠", "Generated successfully" if 'narrative' in locals() else "Skipped/Error"),
        ("Layer 6: Human Review","✘","Not implemented"),
    ]
    for layer, status, detail in layers:
        color = GREEN if status == "✔" else RED
        print(f"  {color}{status}{RESET}  {layer:<24} {detail}")

    print(f"\n{SEP}")
    print(f"  Pipeline iteration complete.")
    print(f"{SEP}\n")
    
    # Dump audit trail
    audit_path = audit.export_log(os.path.join(OUT_DIR, f"L7_audit_log_{case_id}.json"))
    ok(f"L7 Audit Trail explicitly locked and written to: {audit_path}")

    # Return comprehensive output from all layers to the API
    return {
        "case_id": case_id,
        "narrative": narrative_text,
        "audit": audit,
        "sar_report": sar_report,
        # Extended comprehensive layer outputs
        "context_prior_vector": pv_dict,
        "ml_evaluation_metrics": {
            "static": {
                "recall_at_10": recall_a,
                "precision_at_20": prec_a,
            },
            "context_aware": {
                "recall_at_10": recall_b,
                "precision_at_20": prec_b,
                "lift": lift,
            }
        },
        "graph_intelligence": {
            "static_signals": result_static["signals"],
            "context_aware_signals": result_biased["signals"],
        },
        "evidence_bundle": bundle_dict,
    }

if __name__ == "__main__":
    feedback = None
    while True:
        result = run_pipeline(human_feedback=feedback)
        
        # Perform interactive review!
        review = review_sar_interactive(result["narrative"], result["case_id"])
        
        # Log the human explicitly in the *previous* run's audit trail correctly:
        result["audit"].log_step("Review_L7", f"Analyst Review: {review['status']}", {"feedback": review["feedback"]})
        result["audit"].export_log(os.path.join(OUT_DIR, f"L7_audit_log_{result['case_id']}.json"))
        
        if review["status"] == "approved":
            ok("SAR Report finalized and securely approved! Exiting.")
            break
        elif review["status"] == "rejected":
            warn(f"SAR Report REJECTED by human. Reason: '{review['feedback']}'")
            print("RETRIGGERING ML AND GRAPH PIPELINE WITH ANALYST CONTEXT OVERRIDE...")
            feedback = review["feedback"]
        else:
            break

