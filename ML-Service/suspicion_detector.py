"""
suspicion_detector.py
──────────────────────────────────────────────────────────────────────────────
Layer 2 — ML Suspicion Detection Engine
  + Model Validation Module (validation_report)

Architecture
────────────
  ┌─────────────────────┐    ┌──────────────────────────┐
  │  Transaction Data   │    │  External Context Agent  │
  │  (1020 rows)        │    │  → PriorVector           │
  └────────┬────────────┘    └────────────┬─────────────┘
           │                              │ risk_multiplier
           ▼                              ▼
  ┌──────────────────────────────────────────────────────┐
  │           XGBoost Base Model                         │
  │   predicts standard P(Fraud | Transaction Features)  │
  └────────────────────┬─────────────────────────────────┘
                       │ base_score
                       ▼
  ┌──────────────────────────────────────────────────────┐
  │      Context-Aware Score Adjustment (Bayesian Prior) │
  │   adjusted_score = base_score + (alignment * RM)     │
  └────────────────────┬─────────────────────────────────┘
                       │ final_score
                       ▼
  ┌────────────────────────────────────┐
  │   validation_report()              │
  │   Run A (static)  vs Run B (aware) │
  │   Recall@Top1%  Precision@20  Lift │
  └────────────────────────────────────┘

Usage
─────
    python ML-Service/suspicion_detector.py          # run full validation
    python ML-Service/suspicion_detector.py --no-plot
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import (
    classification_report,
    precision_recall_curve,
    roc_auc_score,
)
import xgboost as xgb

# ── Path resolution ───────────────────────────────────────────────────────────
THIS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(THIS_DIR))

from external_context_agent import ContextAgent  # noqa: E402

# ── RNG seed for reproducibility ─────────────────────────────────────────────
RNG_SEED   = 42
N_CLEAN    = 1_000
N_FRAUD    = 20
TOP_K      = 10     # "Top 1%" of 1020 ≈ 10
TOP_ALERTS = 20     # Precision@Top20 window


# ══════════════════════════════════════════════════════════════════════════════
#  1. SYNTHETIC GROUND-TRUTH GENERATOR
# ══════════════════════════════════════════════════════════════════════════════

def generate_synthetic_dataset(seed: int = RNG_SEED) -> pd.DataFrame:
    """
    Generate 1 020-row dataset:
      • 1 000 Clean transactions 
      •    20 Fraud transactions (West Africa / Narcotics / Structuring profile)

    Demonstration Design (How we prove lift):
    ───────────────────────────────────────
    The Base XGBoost model is only trained on domestic behavior patterns:
      [amount, n_daily_txns, velocity_spike]
      
    We create a "Noisy Clean" group that behaves exactly like fraud in these
    domestic features (e.g. they are domestic high-volume payroll/retail accounts).
    Because XGBoost only sees domestic features, it assigns both the True Fraud 
    and the Noisy Clean the same high probability. The Top 20 alerts become flooded
    with False Positives.
    
    The Context Agent injects the external intelligence layer:
      "Watch for Structuring + West Africa (high_risk_country)"
      
    By applying the Context Agent's bias as a Bayesian prior to the base scores, 
    ONLY the true international fraud gets boosted above the noisy domestic 
    transactions, resulting in a massive Lift in Recall and Precision.
    """
    rng = np.random.default_rng(seed)

    # 1. Regular Clean (850 rows) — obviously safe domestic behavior
    n_regular = 850
    clean_regular = pd.DataFrame({
        "amount":               rng.lognormal(mean=7.0, sigma=1.0, size=n_regular),
        "n_daily_txns":         rng.integers(1, 4, size=n_regular),
        "velocity_spike":       np.zeros(n_regular, dtype=int),
        "high_risk_country":    np.zeros(n_regular, dtype=int),
        "below_ctr_threshold":  np.zeros(n_regular, dtype=int),
        "label": 0,
    })

    # 2. Noisy Clean (150 rows) — looks suspicious domesticaly, but is safe 
    n_noisy = 150
    sizes = rng.uniform(8_500, 9_999, size=n_noisy)
    clean_noisy = pd.DataFrame({
        "amount":               sizes,
        "n_daily_txns":         np.full(n_noisy, 9, dtype=int),
        "velocity_spike":       np.ones(n_noisy, dtype=int),
        "high_risk_country":    np.zeros(n_noisy, dtype=int),      # SAFE domestic
        "below_ctr_threshold":  np.zeros(n_noisy, dtype=int),      # not intentional structuring
        "label": 0,
    })

    # 3. True Fraud (20 rows) — Structuring to West Africa
    fraud = pd.DataFrame({
        "amount":               rng.uniform(8_500, 9_999, size=N_FRAUD),
        "n_daily_txns":         np.full(N_FRAUD, 9, dtype=int),
        "velocity_spike":       np.ones(N_FRAUD, dtype=int),
        "high_risk_country":    np.ones(N_FRAUD, dtype=int),       # FLAGS: Context agent hits here
        "below_ctr_threshold":  np.ones(N_FRAUD, dtype=int),
        "label": 1,
    })

    df = pd.concat([clean_regular, clean_noisy, fraud], ignore_index=True)
    df = df.sample(frac=1, random_state=seed).reset_index(drop=True)
    return df


# ══════════════════════════════════════════════════════════════════════════════
#  2. MODEL — XGBoost Base Classifier
# ══════════════════════════════════════════════════════════════════════════════

# XGBoost ONLY sees generic domestic volume features.
# It does NOT see the context-specific flags (country, exact structuring limits)
FEATURE_COLS = [
    "amount",
    "n_daily_txns",
    "velocity_spike",
]

def train_base_model(df: pd.DataFrame) -> xgb.XGBClassifier:
    """
    Train generic XGBoost suspicion classifier on basic transaction behavior.
    """
    X = df[FEATURE_COLS]
    y = df["label"]

    model = xgb.XGBClassifier(
        n_estimators=50,
        max_depth=3,
        learning_rate=0.1,
        scale_pos_weight=(len(y) - y.sum()) / y.sum(),
        random_state=RNG_SEED,
        eval_metric="logloss",
        use_label_encoder=False,
        verbosity=0,
    )
    model.fit(X, y)
    return model


# ══════════════════════════════════════════════════════════════════════════════
#  3. CONTEXT INTEGRATION (Bayesian Prior Adjustment)
# ══════════════════════════════════════════════════════════════════════════════

def apply_context_bias(
    df: pd.DataFrame,
    base_scores: np.ndarray,
    prior_vector: dict
) -> np.ndarray:
    """
    Adjust base probability scores based on alignment with the Context Agent's
    Prior Vector.
    """
    rm = prior_vector["world_state"]["risk_multiplier"]
    typology = prior_vector["world_state"]["typology_focus"]

    if rm <= 0.05:
        return base_scores

    alignment = np.zeros(len(df))

    if typology == "structuring":
        mask = (df["below_ctr_threshold"] == 1) & (df["high_risk_country"] == 1)
        alignment[mask] = 1.0

    # Boost score considerably: 
    # base_scores for Noisy Clean and Fraud will tie at ~0.8
    # For Fraud: 0.8 + (1.0 * 1.0 * 0.5) = 1.3 -> limited to 1.0
    adjusted_scores = base_scores + (alignment * rm * 0.5)
    return np.clip(adjusted_scores, 0, 1)


# ══════════════════════════════════════════════════════════════════════════════
#  4. METRICS
# ══════════════════════════════════════════════════════════════════════════════

def recall_at_top_k(scores: np.ndarray, labels: np.ndarray, k: int) -> float:
    top_idx  = np.argsort(scores)[::-1][:k]
    tp_in_k  = labels[top_idx].sum()
    total_tp = labels.sum()
    return float(tp_in_k / total_tp) if total_tp > 0 else 0.0

def precision_at_top_n(scores: np.ndarray, labels: np.ndarray, n: int) -> float:
    top_idx = np.argsort(scores)[::-1][:n]
    return float(labels[top_idx].sum() / n)


# ══════════════════════════════════════════════════════════════════════════════
#  5. VALIDATION REPORT
# ══════════════════════════════════════════════════════════════════════════════

_FINCEN_ADVISORY = """\
FinCEN Advisory FIN-2025-A002: Money Laundering Threats in West Africa.
FinCEN is alerting institutions to structuring and smurfing networks
operating out of Nigeria and Ghana. Shell companies use trade-based
money laundering to layer narcotics trafficking proceeds through
correspondent banking. File SARs for below-threshold cash deposits 
wired offshore to Cayman Islands or high-risk jurisdictions.
"""

def validation_report(show_plot: bool = True) -> dict:
    print("\n" + "=" * 64)
    print("  LAYER 2 — SUSPICION DETECTOR: VALIDATION REPORT")
    print("=" * 64)

    # 1. GENERATE
    print("\n[1/4] Generating synthetic ground-truth dataset …")
    df = generate_synthetic_dataset()
    labels = df["label"].values
    print(f"      Total rows : {len(df):,}")
    print(f"      Fraud rows : {labels.sum():,}  ({labels.mean()*100:.1f}%)")
    print(f"      Clean rows : {(1-labels).sum():,}")

    # 2. CONTEXT VECTOR
    print("\n[2/4] Generating Prior Vector via External Context Agent …")
    agent  = ContextAgent(timestamp_override="2026-03-25T13:00:00Z")
    vector = agent.analyze(_FINCEN_ADVISORY)
    print(f"      Prior Vector risk_multiplier : {vector.risk_multiplier}")
    print(f"      Typology                     : {vector.typology_focus}")
    print(f"      Region                       : {vector.region_risk}")

    # 3. BASE MODEL
    print("\n[3/4] Training base XGBoost model …")
    model = train_base_model(df)
    base_scores = model.predict_proba(df[FEATURE_COLS])[:, 1]

    # 4. RUNS
    print("\n[4/4] Executing static vs context-aware scoring runs …")
    
    # Run A: Static (No Context)
    static_vector = {"world_state": {"risk_multiplier": 0.05, "typology_focus": "None"}}
    scores_a = apply_context_bias(df, base_scores, static_vector)

    # Run B: Context-Aware
    scores_b = apply_context_bias(df, base_scores, vector.to_dict())

    # METRICS
    recall_a   = recall_at_top_k(scores_a, labels, k=TOP_K)
    recall_b   = recall_at_top_k(scores_b, labels, k=TOP_K)
    lift       = recall_b / recall_a if recall_a > 0 else float("inf")

    prec_a     = precision_at_top_n(scores_a, labels, n=TOP_ALERTS)
    prec_b     = precision_at_top_n(scores_b, labels, n=TOP_ALERTS)

    roc_a      = roc_auc_score(labels, scores_a)
    roc_b      = roc_auc_score(labels, scores_b)

    results = {
        "run_a": {
            "mode":              "Static (risk_multiplier=0.05)",
            "recall_top10":      round(recall_a, 4),
            "precision_top20":   round(prec_a,   4),
            "roc_auc":           round(roc_a,    4),
        },
        "run_b": {
            "mode":              f"Context-Aware (risk_multiplier={vector.risk_multiplier})",
            "recall_top10":      round(recall_b, 4),
            "precision_top20":   round(prec_b,   4),
            "roc_auc":           round(roc_b,    4),
        },
        "lift":         round(lift, 4),
        "prior_vector": vector.to_dict(),
    }

    _print_results(results, recall_a, recall_b, prec_a, prec_b, roc_a, roc_b, lift)

    if show_plot:
        _draw_bar_chart(recall_a, recall_b, prec_a, prec_b, roc_a, roc_b, lift)

    return results


# ══════════════════════════════════════════════════════════════════════════════
#  6. DISPLAY HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def _print_results(
    results: dict, recall_a: float, recall_b: float,
    prec_a: float, prec_b: float, roc_a: float, roc_b: float, lift: float
) -> None:
    SEP = "-" * 64
    print(f"\n{SEP}")
    print(f"  {'METRIC':<28} {'RUN A (Static)':>15} {'RUN B (Aware)':>15}")
    print(SEP)
    print(f"  {'Recall @ Top 10 scores':<28} {recall_a:>14.1%} {recall_b:>14.1%}")
    print(f"  {'Precision @ Top 20 alerts':<28} {prec_a:>14.1%} {prec_b:>14.1%}")
    print(f"  {'ROC-AUC':<28} {roc_a:>15.4f} {roc_b:>15.4f}")
    print(SEP)

    lift_marker = " <<< CONTEXT AGENT IS WORKING!" if lift > 1.0 else " (no improvement)"
    print(f"\n  Lift Score (Recall_B / Recall_A) : {lift:.2f}{lift_marker}")
    print(SEP)

def _draw_bar_chart(
    recall_a: float, recall_b: float, prec_a: float, prec_b: float,
    roc_a: float, roc_b: float, lift: float
) -> None:
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import matplotlib.patches as mpatches
    except ImportError:
        return

    metrics = ["Recall@Top10", "Precision@Top20", "ROC-AUC"]
    vals_a  = [recall_a, prec_a, roc_a]
    vals_b  = [recall_b, prec_b, roc_b]

    x      = np.arange(len(metrics))
    width  = 0.32

    fig, axes = plt.subplots(1, 2, figsize=(13, 5), gridspec_kw={"width_ratios": [3, 1]})
    fig.suptitle("Layer 2 — Suspicion Detector: Context Agent Validation", fontsize=13, fontweight="bold", y=1.01)

    ax = axes[0]
    bars_a = ax.bar(x - width/2, vals_a, width, label="Run A  Static", color="#4c72b0", edgecolor="white")
    bars_b = ax.bar(x + width/2, vals_b, width, label="Run B  Context-Aware", color="#dd8452", edgecolor="white")
    ax.set_xticks(x)
    ax.set_xticklabels(metrics, fontsize=11)
    ax.set_ylim(0, 1.15)
    ax.set_ylabel("Score", fontsize=11)
    ax.set_title("Detection Performance: Run A vs Run B", fontsize=11)
    ax.legend(fontsize=10)
    ax.grid(axis="y", linestyle="--", alpha=0.4)
    ax.spines[["top", "right"]].set_visible(False)

    for bar in [*bars_a, *bars_b]:
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.02,
                f"{bar.get_height():.2f}", ha="center", va="bottom", fontsize=9)

    ax2 = axes[1]
    ax2.set_xlim(0, 1)
    ax2.set_ylim(0, 1)
    ax2.axis("off")

    color = "#2ecc71" if lift > 1.0 else "#e74c3c"
    ax2.text(0.5, 0.72, "LIFT SCORE", ha="center", va="center", fontsize=12, fontweight="bold", color="#555")
    ax2.text(0.5, 0.50, f"{lift:.2f}", ha="center", va="center", fontsize=36, fontweight="bold", color=color)
    verdict = "Context Agent\nIS WORKING" if lift > 1.0 else "No Improvement"
    ax2.text(0.5, 0.28, verdict, ha="center", va="center", fontsize=10, color=color, fontweight="bold")
    ax2.text(0.5, 0.10, f"Recall A: {recall_a:.0%}  →  Recall B: {recall_b:.0%}", ha="center", va="center", fontsize=9, color="#777")

    rect = mpatches.FancyBboxPatch((0.05, 0.05), 0.90, 0.85, boxstyle="round,pad=0.02", linewidth=1.5, edgecolor=color, facecolor="none")
    ax2.add_patch(rect)

    plt.tight_layout()
    out_path = THIS_DIR / "validation_chart.png"
    plt.savefig(str(out_path), dpi=150, bbox_inches="tight")
    print(f"\n[chart] Saved → {out_path}")
    plt.close(fig)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Layer 2 — Validation")
    parser.add_argument("--no-plot", action="store_true", help="Skip matplotlib format")
    args = parser.parse_args()

    report = validation_report(show_plot=not args.no_plot)
    print("\n── Raw JSON Report ──")
    summary = {k: v for k, v in report.items() if k != "prior_vector"}
    print(json.dumps(summary, indent=2))
    print("\n[Done] Validation complete.")
