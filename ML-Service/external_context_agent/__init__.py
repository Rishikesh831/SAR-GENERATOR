"""
external_context_agent — Layer 2: External Intelligence
========================================================
Exposes the ContextAgent class as the primary public API.

    from external_context_agent import ContextAgent

    agent  = ContextAgent()
    vector = agent.analyze(raw_text)   # → PriorVector dataclass
    print(vector.to_json())            # → strict JSON string
"""

from .context_agent import ContextAgent
from .prior_vector  import PriorVector

__all__ = ["ContextAgent", "PriorVector"]
