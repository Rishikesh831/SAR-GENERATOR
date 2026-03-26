"""
signal_extractor.py
────────────────────
Pure NLP extraction layer — no I/O, no side-effects.

Takes a raw text string and returns a RawSignals dict with all matched
patterns, plus a computed risk_multiplier.

The RawSignals TypedDict is the internal contract between the extractor
and the ContextAgent scorer.
"""

from __future__ import annotations

import re
from typing import TypedDict

from .intelligence_kb import (
    COMMODITY_PATTERNS,
    ENFORCEMENT_PATTERNS,
    REGION_PATTERNS,
    RELEVANCE_KEYWORDS,
    TYPOLOGY_PATTERNS,
)


# ─── Internal contract ────────────────────────────────────────────────────────
class RawSignals(TypedDict):
    regions:     dict[str, list[str]]   # label → matched keywords
    typologies:  dict[str, list[str]]
    commodities: dict[str, list[str]]
    enforcement: dict[str, list[str]]
    is_relevant: bool


# ─── Extractor ────────────────────────────────────────────────────────────────
class SignalExtractor:
    """
    Stateless NLP signal extractor.

    Usage
    -----
        extractor = SignalExtractor()
        signals   = extractor.extract(raw_text)
    """

    # Pre-compile a single relevance pattern for speed
    _RELEVANCE_RE = re.compile(
        "|".join(re.escape(kw) for kw in RELEVANCE_KEYWORDS),
        flags=re.IGNORECASE,
    )

    # ── Public API ────────────────────────────────────────────────────────────
    def extract(self, text: str) -> RawSignals:
        """
        Extract all AML signals from *text*.

        Returns
        -------
        RawSignals TypedDict
        """
        normalized = text.lower()

        regions     = self._scan(normalized, REGION_PATTERNS)
        typologies  = self._scan(normalized, TYPOLOGY_PATTERNS)
        commodities = self._scan(normalized, COMMODITY_PATTERNS)
        enforcement = self._scan(normalized, ENFORCEMENT_PATTERNS)
        is_relevant = self._is_relevant(text, regions, typologies, commodities, enforcement)

        return RawSignals(
            regions=regions,
            typologies=typologies,
            commodities=commodities,
            enforcement=enforcement,
            is_relevant=is_relevant,
        )

    # ── Internal helpers ──────────────────────────────────────────────────────
    @staticmethod
    def _scan(
        normalized_text: str,
        kb: dict[str, list[str]],
    ) -> dict[str, list[str]]:
        """
        Return only the labels whose at least one keyword was found,
        mapping label → list-of-matched-keywords.
        """
        hits: dict[str, list[str]] = {}
        for label, keywords in kb.items():
            matched = [kw for kw in keywords if kw in normalized_text]
            if matched:
                hits[label] = matched
        return hits

    @classmethod
    def _is_relevant(
        cls,
        original_text: str,
        regions: dict,
        typologies: dict,
        commodities: dict,
        enforcement: dict,
    ) -> bool:
        """
        Text is financial-crime relevant if:
          (a) it contains an explicit AML keyword, OR
          (b) at least two distinct signal categories returned hits.
        """
        if cls._RELEVANCE_RE.search(original_text):
            return True
        non_empty = sum(
            1 for d in (regions, typologies, commodities, enforcement) if d
        )
        return non_empty >= 2
