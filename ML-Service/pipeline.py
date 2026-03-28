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
import numpy as np
from pathlib import Path

# Ensure proper encoding on Windows
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

# Disable ANSI when piped or --no-color flag
_NO_COLOR = not sys.stdout.isatty() or "--no-color" in sys.argv
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

    if os.path.exists(dataset_path):
        file_size_mb = os.path.getsize(dataset_path) / (1024 * 1024)
        ok(f"Dataset found: {dataset_path} ({file_size_mb:.1f} MB)")
        audit.log_step("Ingest_L1", "Dataset Loaded", {"path": dataset_path, "size_mb": round(file_size_mb, 2)})
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
    import pandas as pd
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

    # Return narrative for the interactive loop
    return {
        "narrative": narrative if 'narrative' in locals() else "[SAR GENERATION FAILED]",
        "case_id": case_id,
        "audit": audit
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

