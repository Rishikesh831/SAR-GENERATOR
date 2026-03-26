"""
risk_scorer.py
──────────────
Translates raw extraction signals into a calibrated risk_multiplier
and selects the primary field values for the Prior Vector.

Scoring model
─────────────
  Base scores per category (additive):
    - Any region hit          +0.15  (capped at +0.25 for 2+ regions)
    - Any typology hit        +0.20  (capped at +0.35 for 2+ typologies)
    - Any commodity hit       +0.15  (capped at +0.25 for 2+ commodities)
    - Any enforcement hit     +0.20  (capped at +0.35 for 2+ enforcement hits)

  Bonus multipliers:
    - Enforcement + Typology  ×1.10
    - Commodity = narcotics/human_trafficking ×1.15  (severe flags)

  Ceilings / floors:
    - NOT relevant text → 0.05  (baseline, per spec)
    - Relevant text     → min 0.35, max 1.0
"""

from __future__ import annotations

import math

from .signal_extractor import RawSignals


# ─── Severity weights ─────────────────────────────────────────────────────────
_SEVERE_COMMODITIES = {"narcotics", "human_trafficking", "arms_trafficking"}

_REGION_BASE        = 0.15
_REGION_EXTRA       = 0.10   # second+ region
_TYPOLOGY_BASE      = 0.20
_TYPOLOGY_EXTRA     = 0.15
_COMMODITY_BASE     = 0.15
_COMMODITY_EXTRA    = 0.10
_ENFORCEMENT_BASE   = 0.20
_ENFORCEMENT_EXTRA  = 0.15

_SEVERE_BONUS       = 0.15
_CORROBORATION_MULT = 1.10   # enforcement + typology both present
_FLOOR_RELEVANT     = 0.35
_CEILING            = 1.0
_BASELINE           = 0.05


# ─── Scorer ───────────────────────────────────────────────────────────────────
class RiskScorer:
    """
    Pure function-equivalent class — stateless scoring.

    Usage
    -----
        scorer = RiskScorer()
        multiplier, justification = scorer.score(signals)
    """

    def score(self, signals: RawSignals) -> tuple[float, str]:
        """
        Compute (risk_multiplier, justification_sentence).
        """
        if not signals["is_relevant"]:
            return _BASELINE, (
                "Text does not contain material financial-crime indicators; "
                "baseline risk_multiplier applied."
            )

        score = 0.0
        notes: list[str] = []

        # ── Regions ──────────────────────────────────────────────────────────
        n_regions = len(signals["regions"])
        if n_regions == 1:
            score += _REGION_BASE
            notes.append(f"region:{next(iter(signals['regions']))}")
        elif n_regions >= 2:
            score += _REGION_BASE + _REGION_EXTRA
            notes.append(f"{n_regions} high-risk regions")

        # ── Typologies ───────────────────────────────────────────────────────
        n_typo = len(signals["typologies"])
        if n_typo == 1:
            score += _TYPOLOGY_BASE
            notes.append(f"typology:{next(iter(signals['typologies']))}")
        elif n_typo >= 2:
            score += _TYPOLOGY_BASE + _TYPOLOGY_EXTRA
            notes.append(f"{n_typo} typologies")

        # ── Commodities ──────────────────────────────────────────────────────
        n_comm = len(signals["commodities"])
        if n_comm == 1:
            score += _COMMODITY_BASE
            label = next(iter(signals["commodities"]))
            notes.append(f"commodity:{label}")
            if label in _SEVERE_COMMODITIES:
                score += _SEVERE_BONUS
                notes.append("(severe commodity bonus)")
        elif n_comm >= 2:
            score += _COMMODITY_BASE + _COMMODITY_EXTRA
            notes.append(f"{n_comm} commodity flags")
            if any(c in _SEVERE_COMMODITIES for c in signals["commodities"]):
                score += _SEVERE_BONUS
                notes.append("(severe commodity bonus)")

        # ── Enforcement patterns ──────────────────────────────────────────────
        n_enf = len(signals["enforcement"])
        if n_enf == 1:
            score += _ENFORCEMENT_BASE
            notes.append(f"enforcement:{next(iter(signals['enforcement']))}")
        elif n_enf >= 2:
            score += _ENFORCEMENT_BASE + _ENFORCEMENT_EXTRA
            notes.append(f"{n_enf} enforcement patterns")

        # ── Corroboration bonus ───────────────────────────────────────────────
        if signals["typologies"] and signals["enforcement"]:
            score *= _CORROBORATION_MULT
            notes.append("(corroboration ×1.10)")

        # ── Clamp ────────────────────────────────────────────────────────────
        score = max(_FLOOR_RELEVANT, min(_CEILING, score))
        score = round(score, 4)

        justification = (
            f"Financial crime indicators detected — {'; '.join(notes)}; "
            f"risk_multiplier set to {score}."
        )
        return score, justification

    # ── Field selectors ───────────────────────────────────────────────────────
    @staticmethod
    def primary_region(signals: RawSignals) -> str:
        if not signals["regions"]:
            return "Undetermined"
        regions = list(signals["regions"].keys())
        # Prefer the first region with the most keyword hits
        best = max(regions, key=lambda r: len(signals["regions"][r]))
        trend = " ^" if len(signals["regions"]) >= 2 else ""
        return f"{best}{trend}"

    @staticmethod
    def primary_typology(signals: RawSignals) -> str:
        if not signals["typologies"]:
            return "None"
        return max(
            signals["typologies"],
            key=lambda t: len(signals["typologies"][t]),
        )

    @staticmethod
    def primary_commodity(signals: RawSignals) -> str:
        if not signals["commodities"]:
            return "None"
        # Prefer severe commodities
        for sev in _SEVERE_COMMODITIES:
            if sev in signals["commodities"]:
                return sev
        return next(iter(signals["commodities"]))

    @staticmethod
    def primary_enforcement(signals: RawSignals) -> str:
        if not signals["enforcement"]:
            return "None"
        return next(iter(signals["enforcement"]))
