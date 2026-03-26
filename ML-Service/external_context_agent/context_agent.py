"""
context_agent.py
─────────────────
Layer 2 — External Context Agent

Public entry-point.  Orchestrates:
  SignalExtractor  →  RiskScorer  →  PriorVector

Usage (single call)
-------------------
    from external_context_agent import ContextAgent

    agent  = ContextAgent()
    vector = agent.analyze(raw_text)

    # Strict JSON output (per spec — no conversational text):
    print(vector.to_json())

Usage (batch mode)
------------------
    vectors = agent.analyze_batch([text1, text2, text3])

Usage (standalone CLI)
----------------------
    python -m external_context_agent.context_agent path/to/advisory.txt
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

from .prior_vector    import PriorVector
from .risk_scorer     import RiskScorer
from .signal_extractor import SignalExtractor


class ContextAgent:
    """
    External Context Agent — Layer 2.

    Parameters
    ----------
    timestamp_override : str, optional
        Force a specific ISO-8601 timestamp (useful for deterministic tests).
        If None (default), uses UTC now.
    """

    def __init__(self, timestamp_override: str | None = None):
        self._extractor = SignalExtractor()
        self._scorer    = RiskScorer()
        self._ts_override = timestamp_override

    # ── Primary API ──────────────────────────────────────────────────────────
    def analyze(self, raw_text: str) -> PriorVector:
        """
        Ingest unstructured financial intelligence text and return a
        PriorVector describing the current world state.

        Parameters
        ----------
        raw_text : str
            Free-form text from FinCEN advisory, FATF update, news API, etc.

        Returns
        -------
        PriorVector
            Call .to_json() for the strict JSON output required by the spec.
        """
        if not isinstance(raw_text, str) or not raw_text.strip():
            raise ValueError("raw_text must be a non-empty string.")

        # Step 1 — NLP extraction
        signals = self._extractor.extract(raw_text)

        # Step 2 — Risk scoring
        risk_multiplier, justification = self._scorer.score(signals)

        # Step 3 — Field selection
        region_risk     = self._scorer.primary_region(signals)
        typology_focus  = self._scorer.primary_typology(signals)
        commodity_flag  = self._scorer.primary_commodity(signals)
        enforcement_rec = self._scorer.primary_enforcement(signals)

        return PriorVector(
            context_timestamp = self._now(),
            justification     = justification,
            region_risk       = region_risk,
            typology_focus    = typology_focus,
            commodity_flag    = commodity_flag,
            enforcement_rec   = enforcement_rec,
            risk_multiplier   = risk_multiplier,
            raw_signals       = {
                "regions":     list(signals["regions"].keys()),
                "typologies":  list(signals["typologies"].keys()),
                "commodities": list(signals["commodities"].keys()),
                "enforcement": list(signals["enforcement"].keys()),
            },
        )

    def analyze_batch(self, texts: list[str]) -> list[PriorVector]:
        """
        Analyze a list of texts and return one PriorVector per text.

        Parameters
        ----------
        texts : list[str]
            Ordered list of raw text inputs.

        Returns
        -------
        list[PriorVector]
        """
        return [self.analyze(t) for t in texts]

    # ── Internal helpers ──────────────────────────────────────────────────────
    def _now(self) -> str:
        if self._ts_override:
            return self._ts_override
        return datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# ─── CLI entry-point ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    """
    Usage:
        python -m external_context_agent.context_agent <path_to_text_file>
        python -m external_context_agent.context_agent        (reads stdin)
    """
    if len(sys.argv) > 1:
        input_path = Path(sys.argv[1])
        if not input_path.exists():
            print(f"[ERROR] File not found: {input_path}", file=sys.stderr)
            sys.exit(1)
        raw = input_path.read_text(encoding="utf-8")
    else:
        print("[ContextAgent] Reading from stdin (Ctrl+Z / Ctrl+D to end)…",
              file=sys.stderr)
        raw = sys.stdin.read()

    agent  = ContextAgent()
    vector = agent.analyze(raw)
    # Output ONLY the JSON — no conversational wrapper (per spec)
    print(vector.to_json())
