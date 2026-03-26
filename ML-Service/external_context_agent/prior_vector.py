"""
prior_vector.py
───────────────
Defines the PriorVector dataclass — the canonical output of the External
Context Agent.  Any downstream layer (ML, Graph, SAR Narrative) that needs
external-world context imports this type.

Design note
-----------
risk_multiplier is a float in [0.05, 1.0].
  0.05  = baseline (news has no financial-crime relevance)
  0.5   = moderate concern (a single indicator present)
  1.0   = maximum alert (multiple corroborating signals)
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field


@dataclass
class PriorVector:
    """Structured output emitted by ContextAgent.analyze()."""

    # ── Mandatory fields ────────────────────────────────────────────────────
    context_timestamp: str          # ISO-8601, e.g. "2025-06-01T09:00:00Z"
    justification: str              # Single sentence explaining the vector

    # ── world_state sub-object ──────────────────────────────────────────────
    region_risk:     str = "Undetermined"   # e.g. "West Africa ^" or "High"
    typology_focus:  str = "None"           # primary ML typology detected
    commodity_flag:  str = "None"           # e.g. "narcotics", "gold", "crypto"
    enforcement_rec: str = "None"           # technical pattern reference
    risk_multiplier: float = 0.05           # 0.05 baseline → 1.0 max alert

    # ── Extra metadata (not in schema but useful for Layer 4) ───────────────
    raw_signals: dict = field(default_factory=dict, repr=False)

    # ── Serialisation ────────────────────────────────────────────────────────
    def to_dict(self) -> dict:
        """Return the STRICT JSON schema dict (matches the spec exactly)."""
        return {
            "context_timestamp": self.context_timestamp,
            "world_state": {
                "region_risk":     self.region_risk,
                "typology_focus":  self.typology_focus,
                "commodity_flag":  self.commodity_flag,
                "enforcement_rec": self.enforcement_rec,
                "risk_multiplier": round(self.risk_multiplier, 4),
            },
            "justification": self.justification,
        }

    def to_json(self, indent: int = 2) -> str:
        """Return STRICT JSON string — suitable for direct API output."""
        return json.dumps(self.to_dict(), indent=indent)

    def to_evidence_dict(self) -> dict:
        """Extended dict for Layer 4 Evidence Builder (includes raw_signals)."""
        d = self.to_dict()
        d["raw_signals"] = self.raw_signals
        return d
