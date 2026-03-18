"""
graph_builder.py
Layer 4 — Graph Intelligence Engine
─────────────────────────────────────
Converts raw transaction data into a directed NetworkX graph.

Nodes  : unique account IDs
Edges  : individual transactions (directed: sender → receiver)
Attrs  : amount, timestamp, transaction_id, country, is_suspicious, pattern
"""

import pandas as pd
import networkx as nx
from pathlib import Path


# ─── Constants ────────────────────────────────────────────────────────────────
REQUIRED_COLUMNS = {
    "transaction_id",
    "timestamp",
    "sender_account",
    "receiver_account",
    "amount",
    "country",
}


# ─── Graph Builder ────────────────────────────────────────────────────────────
class GraphBuilder:
    """
    Builds a directed transaction graph from a pandas DataFrame or CSV path.

    Usage
    -----
        builder = GraphBuilder()
        G = builder.build_from_csv("path/to/transactions.csv")
        # or
        G = builder.build_from_dataframe(df)
    """

    def __init__(self):
        self.graph: nx.DiGraph | None = None
        self.df: pd.DataFrame | None = None

    # ── Public API ────────────────────────────────────────────────────────────
    def build_from_csv(self, filepath: str) -> nx.DiGraph:
        """Load CSV and construct the directed transaction graph."""
        path = Path(filepath)
        if not path.exists():
            raise FileNotFoundError(f"Dataset not found: {filepath}")

        df = pd.read_csv(filepath, parse_dates=["timestamp"])
        return self.build_from_dataframe(df)

    def build_from_dataframe(self, df: pd.DataFrame) -> nx.DiGraph:
        """Construct a directed transaction graph from a DataFrame."""
        self._validate_columns(df)
        self.df = df.copy()

        G = nx.DiGraph()
        G.graph["name"] = "AML Transaction Graph"
        G.graph["total_transactions"] = len(df)

        for _, row in df.iterrows():
            sender   = str(row["sender_account"])
            receiver = str(row["receiver_account"])

            # ── Add / update node attributes ──────────────────────────────
            if sender not in G:
                G.add_node(sender, account_id=sender, total_sent=0.0, total_received=0.0,
                           tx_sent=0, tx_received=0)
            if receiver not in G:
                G.add_node(receiver, account_id=receiver, total_sent=0.0, total_received=0.0,
                           tx_sent=0, tx_received=0)

            G.nodes[sender]["total_sent"]    += float(row["amount"])
            G.nodes[sender]["tx_sent"]       += 1
            G.nodes[receiver]["total_received"] += float(row["amount"])
            G.nodes[receiver]["tx_received"] += 1

            # ── Add edge (multi-edges are collapsed; the last wins for
            #    simple graph; we store as a list attribute instead) ────────
            tx_attr = {
                "transaction_id": str(row["transaction_id"]),
                "amount":         float(row["amount"]),
                "timestamp":      str(row["timestamp"]),
                "country":        str(row.get("country", "")),
                "is_suspicious":  int(row.get("is_suspicious", 0)),
                "pattern":        str(row.get("pattern", "normal")),
            }

            # Support parallel edges between same pair via edge key
            if G.has_edge(sender, receiver):
                G[sender][receiver]["transactions"].append(tx_attr)
                G[sender][receiver]["total_amount"] += tx_attr["amount"]
                G[sender][receiver]["tx_count"]     += 1
            else:
                G.add_edge(
                    sender, receiver,
                    transactions=[tx_attr],
                    total_amount=tx_attr["amount"],
                    tx_count=1,
                )

        self.graph = G
        print(
            f"[GraphBuilder] Graph built: "
            f"{G.number_of_nodes()} nodes | {G.number_of_edges()} edges | "
            f"{len(df)} transactions"
        )
        return G

    # ── Helpers ───────────────────────────────────────────────────────────────
    def _validate_columns(self, df: pd.DataFrame) -> None:
        missing = REQUIRED_COLUMNS - set(df.columns)
        if missing:
            raise ValueError(f"Dataset missing required columns: {missing}")

    def get_summary(self) -> dict:
        """Return a brief summary of the built graph."""
        if self.graph is None:
            return {"error": "Graph not built yet."}
        G = self.graph
        return {
            "nodes":        G.number_of_nodes(),
            "edges":        G.number_of_edges(),
            "transactions": G.graph.get("total_transactions", 0),
            "is_directed":  G.is_directed(),
            "density":      round(nx.density(G), 6),
        }
