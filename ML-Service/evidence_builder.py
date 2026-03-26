import json
import uuid
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

# ══════════════════════════════════════════════════════════════════════════════
#  LAYER 5: THE EVIDENCE BUILDER (SCHEMA)
# ══════════════════════════════════════════════════════════════════════════════

class EvidenceObject(BaseModel):
    """
    Strict schema for verifiable, math-based evidence.
    Hard objects only. No "vibes" or unstructured news snippets.
    """
    source_layer: str = Field(..., description="(e.g., 'Graph_L4', 'ML_L3', 'Context_L2')")
    finding_type: str = Field(..., description="(e.g., 'Star_Topology_Detected', 'Z_Score_Outlier')")
    forensic_facts: Dict[str, Any] = Field(..., description="Dict of raw numbers: e.g., 'volume': 50000, 'nodes': 12")
    rationale: str = Field(..., description="One sentence of math-based logic: 'Activity is 4x baseline'")


class CaseBundle(BaseModel):
    """
    The aggregate bundle of all evidence to be passed to the SAR generator (Layer 6).
    """
    case_id: str
    entity_id: str
    evidence: List[EvidenceObject]
    
    def to_json(self) -> str:
        return self.model_dump_json(indent=2)


# ══════════════════════════════════════════════════════════════════════════════
#  LAYER 5: EVIDENCE COLLECTOR
# ══════════════════════════════════════════════════════════════════════════════

class EvidenceCollector:
    """
    Aggregates facts from Graph (L4), ML (L3), and Context (L2) into a Case Bundle.
    Strips out all narrative and subjective analysis.
    """
    def __init__(self, case_id: Optional[str] = None, entity_id: str = "UNKNOWN"):
        self.case_id = case_id or str(uuid.uuid4())
        self.entity_id = entity_id
        self.evidence_list: List[EvidenceObject] = []

    def add_ml_evidence(self, feature_importance: Dict[str, float], z_score: float, anomaly_score: float):
        """
        Aggregates ML Evidence: Feature importance, Z-scores.
        """
        self.evidence_list.append(
            EvidenceObject(
                source_layer="ML_L3",
                finding_type="Model_Anomaly_Threshold_Exceeded",
                forensic_facts={
                    "z_score": round(z_score, 2),
                    "anomaly_score": round(anomaly_score, 4),
                    "top_features": feature_importance
                },
                rationale=f"Anomaly score of {anomaly_score:.2f} exceeds threshold with Z-score {z_score:.1f}."
            )
        )

    def add_graph_evidence(self, topology: str, centrality: float, node_count: int, edge_volume_usd: float):
        """
        Aggregates Graph Evidence: Cluster topology, Centrality.
        """
        self.evidence_list.append(
            EvidenceObject(
                source_layer="Graph_L4",
                finding_type=f"{topology.capitalize()}_Topology_Detected",
                forensic_facts={
                    "nodes": node_count,
                    "centrality_score": round(centrality, 3),
                    "total_volume_usd": round(edge_volume_usd, 2)
                },
                rationale=f"Subgraph forms a {topology} structure with {node_count} nodes passing ${edge_volume_usd:,.2f}."
            )
        )

    def add_context_evidence(self, prior_vector: Dict[str, Any]):
        """
        Aggregates Context Evidence: Regulatory tags from the Prior Vector.
        CRITICAL CONSTRAINT: Strips out text, news, and geopolitical 'vibe'.
        Passes strictly enumerated parameters.
        """
        world_state = prior_vector.get("world_state", {})
        
        self.evidence_list.append(
            EvidenceObject(
                source_layer="Context_L2",
                finding_type="Regulatory_Prior_Match",
                forensic_facts={
                    "risk_multiplier": world_state.get("risk_multiplier", 1.0),
                    "typology_tag": world_state.get("typology_focus", "None"),
                    "region_tag": world_state.get("region_risk", "None"),
                    "commodity_tag": world_state.get("commodity_flag", "None")
                },
                rationale=f"Transaction profile aligns explicitly with target typology ({world_state.get('typology_focus')})."
            )
        )

    def assemble_case(self) -> str:
        """
        Return a single JSON 'CaseBundle' object.
        """
        bundle = CaseBundle(
            case_id=self.case_id,
            entity_id=self.entity_id,
            evidence=self.evidence_list
        )
        return bundle.to_json()


# ══════════════════════════════════════════════════════════════════════════════
#  TEST EXECUTION BLOCK
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    collector = EvidenceCollector(entity_id="ACC-88392")
    
    # 1. Add ML Evidence
    collector.add_ml_evidence(
        feature_importance={"velocity_spike": 0.45, "cross_border": 0.30, "below_ctr_threshold": 0.25},
        z_score=3.8,
        anomaly_score=0.985
    )
    
    # 2. Add Graph Evidence
    collector.add_graph_evidence(
        topology="Star",
        centrality=0.85,
        node_count=12,
        edge_volume_usd=48500.00
    )
    
    # 3. Add Context Evidence (Simulated PriorVector)
    sample_prior = {
        "context_timestamp": "2026-03-25T12:00:00Z",
        "world_state": {
            "risk_multiplier": 1.4,
            "typology_focus": "structuring",
            "region_risk": "West Africa ^",
            "commodity_flag": "narcotics",
            "enforcement_rec": "HSBC_pattern"
        }
    }
    collector.add_context_evidence(sample_prior)
    
    # Validate Output
    case_json = collector.assemble_case()
    print("=== L5 ASSEMBLED CASE BUNDLE (JSON) ===")
    print(case_json)
