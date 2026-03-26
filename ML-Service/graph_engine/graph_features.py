"""
graph_features.py
Layer 3 — Graph Intelligence Engine
─────────────────────────────────────
Computes per-account network metrics that feed ML models (e.g. XGBoost).

Features computed for each node:
  ─ in_degree              : number of incoming edges (unique sender accounts)
  ─ out_degree             : number of outgoing edges
  ─ in_strength            : total amount received
  ─ out_strength           : total amount sent
  ─ pagerank               : PageRank centrality (importance in flow network)
  ─ betweenness_centrality : fraction of shortest paths passing through node
  ─ clustering_coefficient : local clustering (0 for DiGraph = undirected approx)
  ─ in_out_ratio           : in_degree / (out_degree + 1) — fan-in signature
  ─ strength_ratio         : in_strength / (out_strength + 1) — pass-through ratio
  ─ tx_sent                : raw transaction count sent
  ─ tx_received            : raw transaction count received
"""

from __future__ import annotations

import pandas as pd
import networkx as nx
import numpy as np


# ─── Feature Engine ───────────────────────────────────────────────────────────
class GraphFeatureEngine:
    """
    Computes network-level features for every account node.

    Usage
    -----
        engine = GraphFeatureEngine()
        feature_df = engine.compute(G)
    """

    def compute(self, G: nx.DiGraph) -> pd.DataFrame:
        """
        Compute graph features for all nodes and return as a DataFrame.

        Parameters
        ----------
        G : nx.DiGraph
            The directed transaction graph produced by GraphBuilder.

        Returns
        -------
        pd.DataFrame
            One row per account with all computed features.
        """
        if G.number_of_nodes() == 0:
            return pd.DataFrame()

        print("[GraphFeatureEngine] Computing degree features …")
        degree_features = self._compute_degree_features(G)

        print("[GraphFeatureEngine] Computing PageRank …")
        G_simple = nx.DiGraph(G)
        pagerank = nx.pagerank(G_simple, alpha=0.85, max_iter=200, tol=1e-6)

        print("[GraphFeatureEngine] Computing betweenness centrality …")
        # For large graphs use approximation (k=min(500, n))
        n = G_simple.number_of_nodes()
        k_sample = min(100, n)   # small k = fast approximation, still meaningful
        betweenness = nx.betweenness_centrality(
            G_simple, k=k_sample, normalized=True, weight="total_amount"
        )

        print("[GraphFeatureEngine] Computing clustering coefficient …")
        # nx.clustering works on undirected; for directed we use the undirected view
        clustering = nx.clustering(G_simple.to_undirected())

        rows: list[dict] = []
        for node in G.nodes():
            nd = G.nodes[node]
            in_deg   = G.in_degree(node)
            out_deg  = G.out_degree(node)
            in_str   = nd.get("total_received", 0.0)
            out_str  = nd.get("total_sent", 0.0)
            tx_sent  = nd.get("tx_sent", 0)
            tx_recv  = nd.get("tx_received", 0)

            rows.append({
                "account_id":             node,
                "in_degree":              in_deg,
                "out_degree":             out_deg,
                "in_strength":            round(in_str, 2),
                "out_strength":           round(out_str, 2),
                "tx_sent":                tx_sent,
                "tx_received":            tx_recv,
                "in_out_ratio":           round(in_deg / (out_deg + 1), 4),
                "strength_ratio":         round(in_str / (out_str + 1e-9), 4),
                "pagerank":               round(pagerank.get(node, 0.0), 8),
                "betweenness_centrality": round(betweenness.get(node, 0.0), 8),
                "clustering_coefficient": round(clustering.get(node, 0.0), 6),
            })

        df = pd.DataFrame(rows).sort_values("pagerank", ascending=False).reset_index(drop=True)
        print(f"[GraphFeatureEngine] Features computed for {len(df)} accounts.")
        return df

    # ── Private ───────────────────────────────────────────────────────────────
    def _compute_degree_features(self, G: nx.DiGraph) -> dict:
        """Helper — not strictly needed but reserved for future extensions."""
        return {}


# ─── Convenience wrapper ──────────────────────────────────────────────────────
def compute_graph_features(G: nx.DiGraph) -> pd.DataFrame:
    """Module-level convenience function."""
    return GraphFeatureEngine().compute(G)
