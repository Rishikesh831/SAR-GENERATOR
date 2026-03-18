"""
graph_pipeline.py
Layer 4 — Graph Intelligence Engine
─────────────────────────────────────
Orchestrates the full Layer 4 pipeline:

  Load CSV → Build Graph → Run Detectors → Compute Features → Output Signals

This is the single entry-point consumed by the Layer 5 Evidence Builder.

Usage (standalone)
------------------
    python graph_pipeline.py

Usage (as a module from Layer 5)
---------------------------------
    from graph_engine.graph_pipeline import GraphPipeline

    pipeline = GraphPipeline(csv_path="Dataset/synthetic_aml_transactions.csv")
    result   = pipeline.run()

    # result["signals"]      → dict of pattern signals (list of dicts)
    # result["features_df"]  → pd.DataFrame of per-account graph features
    # result["graph"]        → nx.DiGraph
    # result["summary"]      → high-level summary dict
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path

import pandas as pd

from graph_engine.graph_builder    import GraphBuilder
from graph_engine.pattern_detectors import run_all_detectors, DetectorConfig
from graph_engine.graph_features   import compute_graph_features


# ─── Pipeline ─────────────────────────────────────────────────────────────────
class GraphPipeline:
    """
    Full Layer 4 orchestration: data → graph → patterns → features → signals.

    Parameters
    ----------
    csv_path : str
        Path to the transactions CSV file.
    config : DetectorConfig, optional
        Tunable thresholds for each pattern detector.
    case_id : str, optional
        Optional case identifier attached to every signal output.
    """

    def __init__(
        self,
        csv_path: str,
        config: DetectorConfig | None = None,
        case_id: str = "UNKNOWN",
    ):
        self.csv_path = csv_path
        self.config   = config or DetectorConfig()
        self.case_id  = case_id

        # Outputs (populated after run())
        self.graph       = None
        self.signals     = {}
        self.features_df = pd.DataFrame()
        self.summary     = {}

    # ── Main entry-point ─────────────────────────────────────────────────────
    def run(self) -> dict:
        """
        Execute the full Layer 4 pipeline.

        Returns
        -------
        dict with keys:
          signals      : dict[pattern_name → list[signal_dict]]
          features_df  : pd.DataFrame
          graph        : nx.DiGraph
          summary      : dict
        """
        t0 = time.time()
        print("\n" + "═" * 60)
        print("  LAYER 4 — GRAPH INTELLIGENCE ENGINE")
        print("═" * 60)

        # ── Step 1: Build graph ───────────────────────────────────────────
        print("\n[Step 1] Building transaction graph …")
        builder = GraphBuilder()
        G = builder.build_from_csv(self.csv_path)
        self.graph = G
        graph_summary = builder.get_summary()
        print(f"  {graph_summary}")

        # ── Step 2: Run pattern detectors ─────────────────────────────────
        print("\n[Step 2] Running pattern detectors …")
        self.signals = run_all_detectors(G, self.config)

        # Tag every signal with case_id
        for pattern_signals in self.signals.values():
            for sig in pattern_signals:
                sig["case_id"] = self.case_id

        # ── Step 3: Compute graph features ───────────────────────────────
        print("\n[Step 3] Computing graph features …")
        self.features_df = compute_graph_features(G)

        # ── Step 4: Assemble summary ───────────────────────────────────────
        elapsed = round(time.time() - t0, 2)
        total_signals = sum(len(v) for v in self.signals.values())

        self.summary = {
            "case_id":           self.case_id,
            "csv_path":          str(self.csv_path),
            "graph":             graph_summary,
            "signals": {
                pattern: len(sigs)
                for pattern, sigs in self.signals.items()
            },
            "total_signals":     total_signals,
            "accounts_profiled": len(self.features_df),
            "elapsed_seconds":   elapsed,
        }

        print("\n" + "─" * 60)
        print("[Layer 4 Complete] Summary:")
        for k, v in self.summary.items():
            print(f"  {k}: {v}")
        print("─" * 60 + "\n")

        return {
            "signals":     self.signals,
            "features_df": self.features_df,
            "graph":       self.graph,
            "summary":     self.summary,
        }

    # ── Export helpers ────────────────────────────────────────────────────────
    def export_signals_json(self, output_path: str = "graph_signals.json") -> str:
        """Serialize detection signals to JSON for Layer 5 consumption."""
        if not self.signals:
            raise RuntimeError("Run the pipeline first (call .run()).")

        # Convert any non-serialisable items
        def _clean(obj):
            if isinstance(obj, float) and (obj != obj):   # NaN check
                return None
            if isinstance(obj, (pd.Timestamp,)):
                return str(obj)
            return obj

        def _sanitise(d: dict) -> dict:
            return {k: _clean(v) for k, v in d.items()}

        payload = {}
        for pattern, sigs in self.signals.items():
            payload[pattern] = [_sanitise(s) for s in sigs]

        out = Path(output_path)
        out.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
        print(f"[Export] Signals written → {out.resolve()}")
        return str(out.resolve())

    def export_features_csv(self, output_path: str = "graph_features.csv") -> str:
        """Write per-account graph feature table to CSV."""
        if self.features_df.empty:
            raise RuntimeError("Run the pipeline first (call .run()).")
        out = Path(output_path)
        self.features_df.to_csv(out, index=False)
        print(f"[Export] Features written → {out.resolve()}")
        return str(out.resolve())

    # ── Layer 5 interface ─────────────────────────────────────────────────────
    def get_signals_flat(self) -> list[dict]:
        """Return all signals as a single flat list (for Layer 5 Evidence Builder)."""
        flat = []
        for pattern_sigs in self.signals.values():
            flat.extend(pattern_sigs)
        return flat

    def get_top_risk_accounts(self, top_n: int = 20) -> pd.DataFrame:
        """
        Return top-N accounts by risk based on graph features:
        high PageRank + high in_degree + high betweenness.
        """
        if self.features_df.empty:
            return pd.DataFrame()

        df = self.features_df.copy()
        # Composite risk score from graph features
        df["_risk"] = (
            df["pagerank"].rank(pct=True) * 0.35
            + df["in_degree"].rank(pct=True) * 0.30
            + df["betweenness_centrality"].rank(pct=True) * 0.20
            + df["in_out_ratio"].rank(pct=True) * 0.15
        )
        return df.nlargest(top_n, "_risk").drop(columns=["_risk"])


# ─── Standalone runner ────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys

    # Resolve dataset path relative to this file
    THIS_DIR  = Path(__file__).resolve().parent
    ROOT_DIR  = THIS_DIR.parent.parent          # SAR-Generator/
    CSV_PATH  = ROOT_DIR / "Dataset" / "synthetic_aml_transactions.csv"

    if not CSV_PATH.exists():
        print(f"[ERROR] Dataset not found at: {CSV_PATH}")
        print("Usage: python graph_pipeline.py [optional_csv_path]")
        sys.exit(1)

    # Optional override from CLI arg
    if len(sys.argv) > 1:
        CSV_PATH = Path(sys.argv[1])

    pipeline = GraphPipeline(
        csv_path=str(CSV_PATH),
        case_id="DEMO-001",
    )
    result = pipeline.run()

    # Print top smurfing signals
    smurfing_signals = result["signals"].get("smurfing", [])
    print(f"\n── Top 5 Smurfing Signals ──")
    for sig in smurfing_signals[:5]:
        print(f"  Account: {sig['account']} | Senders: {sig['unique_senders']} "
              f"| TxCount: {sig['transaction_count']} | Risk: {sig['risk_score']}")

    # Print top funnel accounts
    funnel_signals = result["signals"].get("funnel_accounts", [])
    print(f"\n── Top 5 Funnel Accounts ──")
    for sig in funnel_signals[:5]:
        print(f"  Account: {sig['account']} | In: {sig['in_degree']} "
              f"| Out: {sig['out_degree']} | Risk: {sig['risk_score']}")

    # Print top circular transfers
    circular_signals = result["signals"].get("circular_transfer", [])
    print(f"\n── Top 5 Circular Transfers ──")
    for sig in circular_signals[:5]:
        print(f"  Accounts: {sig['accounts']} | Len: {sig['cycle_length']} "
              f"| Amount: {sig['total_amount']} | Risk: {sig['risk_score']}")

    # Print top risk accounts from feature table
    print(f"\n── Top 10 Risk Accounts (by Graph Features) ──")
    top_accounts = pipeline.get_top_risk_accounts(top_n=10)
    if not top_accounts.empty:
        print(top_accounts[["account_id", "in_degree", "out_degree",
                             "pagerank", "betweenness_centrality", "in_out_ratio"]].to_string(index=False))

    # Export outputs
    out_dir = THIS_DIR / "outputs"
    out_dir.mkdir(exist_ok=True)
    pipeline.export_signals_json(str(out_dir / "graph_signals.json"))
    pipeline.export_features_csv(str(out_dir / "graph_features.csv"))

    print("\n[Done] Layer 4 Graph Intelligence Engine completed successfully.")
