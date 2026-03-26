import sys
import os
import json
from pathlib import Path

# Add ML-Service to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from external_context_agent import ContextAgent
from suspicion_detector import generate_synthetic_dataset, train_base_model, apply_context_bias
from graph_engine.graph_pipeline import GraphPipeline
from evidence_builder import EvidenceCollector

class MockContextAgent:
    def analyze(self, text):
        class PV:
            risk_multiplier = 1.5
            typology_focus = "smurfing"
            def to_dict(self):
                return {"world_state": {"risk_multiplier": 1.5, "typology_focus": "smurfing", "region_risk": "West Africa", "commodity_flag": "narcotics", "enforcement_rec": "None"}}
        return PV()

def run_pipeline():
    print("="*60)
    print(" END TO END PIPELINE TEST (Matching Architecture to Code)")
    print("="*60)

    print("\n=== SYSTEM ARCHITECTURE DELTAS DISCOVERED ===")
    print("Comparing codebase against image.png:")
    print("1. Layer Numbering mismatch: The python comment blocks number Context as L2, ML as L3, Graph as L4, Evidence as L5. Image labels them as L1 (Data Ingest) through L5 (SAR).")
    print("2. Layer 3 (Image) / Graph Engine: Image states graph detection is BIASED towards patterns in the Prior Vector. Code (pattern_detectors.py) has static config and IGNORES the prior vector.")
    print("3. Layer 4 (Image) / Evidence Builder: Image explicitly requires 'no context signal here' so it solely relies on facts. Code (evidence_builder.py) has an `add_context_evidence` function that brings the narrative vector back in.")
    print("4. Layer 6 (Image) / Human Review: Not implemented.")

    print("\n\n--- EXTERNAL CONTEXT AGENT ---")
    fincen_text = "FinCEN Advisory FIN-2025-A002: Money Laundering Threats in West Africa. Smurfing and narcotics."
    print("Simulating Context Agent analysis...")
    agent = MockContextAgent()
    try:
        prior_vector = agent.analyze(fincen_text)
        print(f"OUTPUT: Prior Vector generated. Risk Multiplier: {prior_vector.risk_multiplier}, Typology: {prior_vector.typology_focus}")
        pv_dict = prior_vector.to_dict()
    except Exception as e:
        print(f"FAILED to run Context Agent: {e}")
        pv_dict = {"world_state": {"risk_multiplier": 1.5, "typology_focus": "smurfing", "region_risk": "West Africa", "commodity_flag": "narcotics", "enforcement_rec": "None"}}

    print("\n--- LAYER 1: DATA INGESTION ---")
    dataset_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "Dataset", "synthetic_aml_transactions.csv"))
    print(f"OUTPUT: Found dataset at {dataset_path}")

    print("\n--- LAYER 2: SUSPICION DETECTION ---")
    print("OUTPUT: Training base model and applying context Prior Vector bias.")
    df = generate_synthetic_dataset()
    model = train_base_model(df)
    base_scores = model.predict_proba(df[["amount", "n_daily_txns", "velocity_spike"]])[:, 1]
    adjusted_scores = apply_context_bias(df, base_scores, pv_dict)
    print(f"OUTPUT: Anomaly scores generated. Max score: {max(adjusted_scores):.4f}")

    print("\n--- LAYER 3: GRAPH INTELLIGENCE ---")
    pipeline = GraphPipeline(csv_path=dataset_path, case_id="CASE-001")
    graph_results = pipeline.run()
    smurf_count = len(graph_results["signals"].get("smurfing", []))
    print(f"OUTPUT: Graph pipeline run successfully. Found {smurf_count} smurfing clusters.")
    print("WARNING: Graph pipeline DID NOT use the Context Agent's prior vector!")

    print("\n--- LAYER 4: EVIDENCE BUILDER ---")
    collector = EvidenceCollector(entity_id="ACC-88392")
    # This simulates exactly what the python layer has in evidence_builder.py (which violates the image rule)
    collector.add_context_evidence(pv_dict)
    collector.add_ml_evidence(
        feature_importance={"amount": 0.4, "n_daily_txns": 0.6},
        z_score=3.5,
        anomaly_score=max(adjusted_scores)
    )
    collector.add_graph_evidence(
        topology="smurfing", centrality=0.92, node_count=35, edge_volume_usd=85000.0
    )
    case_json = collector.assemble_case()
    print("OUTPUT: Final Evidence Bundle:")
    print(case_json)
    print("WARNING: Notice how the Evidence Bundle above INCLUDES 'Context_L2' objects, which violates 'no context signal here'.")

    print("\n--- LAYER 5: SAR GENERATOR ---")
    print("OUTPUT: Ready. Missing running Ollama model to generate text locally, but script allows passing bundle to LLM.")

if __name__ == '__main__':
    run_pipeline()
