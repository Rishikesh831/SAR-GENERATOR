"""
graph_engine package
Layer 4 — Graph Intelligence Engine
"""

from graph_engine.graph_builder      import GraphBuilder
from graph_engine.pattern_detectors  import (
    detect_smurfing,
    detect_funnel_accounts,
    detect_layering,
    detect_circular_transfers,
    run_all_detectors,
    DetectorConfig,
)
from graph_engine.graph_features     import compute_graph_features, GraphFeatureEngine
from graph_engine.graph_pipeline     import GraphPipeline

__all__ = [
    "GraphBuilder",
    "GraphPipeline",
    "GraphFeatureEngine",
    "DetectorConfig",
    "compute_graph_features",
    "detect_smurfing",
    "detect_funnel_accounts",
    "detect_layering",
    "detect_circular_transfers",
    "run_all_detectors",
]
