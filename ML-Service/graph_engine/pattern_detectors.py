"""
pattern_detectors.py
Layer 3 — Graph Intelligence Engine
─────────────────────────────────────
Detects four AML typologies in the transaction graph.

PERFORMANCE NOTES (200k txn, 2000 accounts, 195k edges dataset)
────────────────────────────────────────────────────────────────
All detectors are designed to complete in seconds, not minutes:

1. Smurfing       – O(N) node scan, pure degree/amount aggregation.
2. Funnel Account – O(N) node scan, degree threshold filter.
3. Layering       – BFS from top-K high-risk SOURCE nodes only,
                    with strict per-source path cap.
4. Circular       – simple_cycles on a tiny "edge-contracted" subgraph
                    of only the TOP-50 highest-risk nodes (by degree);
                    capped at CIRCULAR_MAX_RESULTS.
"""

from __future__ import annotations

import random
from typing import Any

import networkx as nx
import numpy as np


# ─── Configuration ────────────────────────────────────────────────────────────
class DetectorConfig:
    # ── Smurfing ──────────────────────────────────────────────────────────────
    SMURF_MIN_SENDERS:    int   = 10      # unique inbound senders to flag
    SMURF_MIN_TX_COUNT:   int   = 15      # min inbound transaction count
    SMURF_MAX_AVG_AMOUNT: float = 3000.0  # max avg amount (structuring = small)
    SMURF_TOP_N:          int   = 50      # return at most top-N signals

    # ── Funnel Accounts ───────────────────────────────────────────────────────
    FUNNEL_MIN_IN_DEGREE:  int = 10
    FUNNEL_MIN_OUT_DEGREE: int = 8
    FUNNEL_TOP_N:          int = 50

    # ── Layering ──────────────────────────────────────────────────────────────
    LAYERING_MIN_HOPS:    int = 3
    LAYERING_MAX_HOPS:    int = 4
    LAYERING_SOURCE_TOP_K: int = 30   # BFS from top-K suspicious sources only
    LAYERING_MAX_PATHS:   int = 200   # hard cap on total paths returned

    # ── Circular ──────────────────────────────────────────────────────────────
    CIRCULAR_TOP_N_NODES:  int = 80   # restrict cycle search to top-N nodes
    CIRCULAR_MAX_LENGTH:   int = 5    # max cycle length to store
    CIRCULAR_MAX_RESULTS:  int = 100  # hard cap on returned cycles


# ─── 1. Smurfing Detection ────────────────────────────────────────────────────
def detect_smurfing(
    G: nx.MultiDiGraph,
    config: DetectorConfig = DetectorConfig(),
) -> list[dict]:
    """
    Fan-in pattern: many distinct senders → one aggregator account.
    O(N + E) — iterates over each node's predecessor list once.
    """
    signals: list[dict] = []

    for node in G.nodes():
        predecessors = list(G.predecessors(node))
        unique_senders = len(set(predecessors))

        if unique_senders < config.SMURF_MIN_SENDERS:
            continue

        # Aggregate inbound amounts & timestamps using pre-stored edge attrs
        amounts: list[float] = []
        timestamps: list[str] = []
        for sender in predecessors:
            for edata in G[sender][node].values():
                amounts.append(edata.get("amount", 0.0))
                ts = edata.get("timestamp", "")
                if ts:
                    timestamps.append(ts)

        tx_count = G.nodes[node].get("tx_received", 0) or len(amounts)
        if tx_count < config.SMURF_MIN_TX_COUNT:
            continue

        total_amount = G.nodes[node].get("total_received", 0.0) or float(sum(amounts))
        avg_amount   = total_amount / max(tx_count, 1)

        if avg_amount > config.SMURF_MAX_AVG_AMOUNT:
            continue  # large amounts → not structuring

        sender_score = min(unique_senders / 50.0, 1.0)
        tx_score     = min(tx_count / 100.0, 1.0)
        amt_score    = max(1.0 - avg_amount / config.SMURF_MAX_AVG_AMOUNT, 0.0)
        risk_score   = round(0.40 * sender_score + 0.30 * tx_score + 0.30 * amt_score, 4)

        signals.append({
            "pattern":           "smurfing",
            "account":           node,
            "unique_senders":    unique_senders,
            "transaction_count": tx_count,
            "total_amount":      round(total_amount, 2),
            "avg_amount":        round(avg_amount, 2),
            "risk_score":        risk_score,
            "timestamp_min":     min(timestamps) if timestamps else None,
            "timestamp_max":     max(timestamps) if timestamps else None,
            "source_layer":      "graph_intelligence",
        })

    signals.sort(key=lambda s: s["risk_score"], reverse=True)
    return signals[: config.SMURF_TOP_N]


# ─── 2. Funnel Account Detection ──────────────────────────────────────────────
def detect_funnel_accounts(
    G: nx.MultiDiGraph,
    config: DetectorConfig = DetectorConfig(),
) -> list[dict]:
    """
    Hub pattern: high in-degree AND high out-degree on the same account.
    O(N) — single pass over node degree views.
    """
    signals: list[dict] = []

    for node in G.nodes():
        in_deg  = G.in_degree(node)
        out_deg = G.out_degree(node)

        if in_deg < config.FUNNEL_MIN_IN_DEGREE or out_deg < config.FUNNEL_MIN_OUT_DEGREE:
            continue

        nd          = G.nodes[node]
        total_recv  = nd.get("total_received", 0.0)
        total_sent  = nd.get("total_sent", 0.0)
        passthrough = min(total_sent / (total_recv + 1e-9), 1.0) if total_recv > 0 else 0.0

        in_score   = min(in_deg  / (config.FUNNEL_MIN_IN_DEGREE  * 5), 1.0)
        out_score  = min(out_deg / (config.FUNNEL_MIN_OUT_DEGREE * 5), 1.0)
        risk_score = round(0.35 * in_score + 0.35 * out_score + 0.30 * passthrough, 4)

        signals.append({
            "pattern":          "funnel_account",
            "account":          node,
            "in_degree":        in_deg,
            "out_degree":       out_deg,
            "total_received":   round(total_recv, 2),
            "total_sent":       round(total_sent, 2),
            "passthrough_ratio": round(passthrough, 4),
            "risk_score":       risk_score,
            "source_layer":     "graph_intelligence",
        })

    signals.sort(key=lambda s: s["risk_score"], reverse=True)
    return signals[: config.FUNNEL_TOP_N]


# ─── 3. Layering Detection ────────────────────────────────────────────────────
def detect_layering(
    G: nx.MultiDiGraph,
    config: DetectorConfig = DetectorConfig(),
) -> list[dict]:
    """
    Multi-hop chain: A → B → C → D (3–4 hops).

    Performance strategy:
      • Only seed BFS from top-K suspicious SOURCE nodes (high out-degree,
        low in-degree) — not every node pair.
      • `nx.dfs_edges` with depth_limit is O(V+E) per source but we cap at K.
      • Hard-cap total paths at LAYERING_MAX_PATHS.
    """
    # ── Identify top-K suspicious source accounts ──────────────────────────
    # High out-degree + low in-degree = likely money origin / layering start
    scored_nodes = sorted(
        G.nodes(),
        key=lambda n: (G.out_degree(n) - G.in_degree(n)),
        reverse=True,
    )
    source_pool = scored_nodes[: config.LAYERING_SOURCE_TOP_K]

    signals: list[dict] = []
    seen_paths: set[tuple] = set()
    total_found = 0

    for source in source_pool:
        if total_found >= config.LAYERING_MAX_PATHS:
            break

        # BFS / DFS up to MAX_HOPS deep from this source
        # nx.dfs_labeled_edges is faster than all_simple_paths on dense graphs
        path_stack: list[list[str]] = [[source]]

        while path_stack and total_found < config.LAYERING_MAX_PATHS:
            current_path = path_stack.pop()
            current_node = current_path[-1]
            hop_count    = len(current_path) - 1

            # Record valid paths (min hops reached)
            if hop_count >= config.LAYERING_MIN_HOPS:
                path_key = tuple(current_path)
                if path_key not in seen_paths:
                    seen_paths.add(path_key)

                    amounts = []
                    for i in range(len(current_path) - 1):
                        a, b = current_path[i], current_path[i + 1]
                        if G.has_edge(a, b):
                            amounts.append(sum(edata.get("amount", 0.0) for edata in G[a][b].values()))

                    min_amt = float(min(amounts)) if amounts else 0.0
                    avg_amt = float(sum(amounts) / len(amounts)) if amounts else 0.0

                    signals.append({
                        "pattern":      "layering",
                        "path":         list(current_path),
                        "hop_count":    hop_count,
                        "amount":       round(min_amt, 2),
                        "avg_amount":   round(avg_amt, 2),
                        "accounts":     list(current_path),
                        "risk_score":   round(hop_count / config.LAYERING_MAX_HOPS, 4),
                        "source_layer": "graph_intelligence",
                    })
                    total_found += 1

            # Continue extending if below max hops
            if hop_count < config.LAYERING_MAX_HOPS:
                for neighbour in G.successors(current_node):
                    if neighbour not in current_path:  # no revisiting
                        path_stack.append(current_path + [neighbour])

    signals.sort(key=lambda s: (s["hop_count"], s["amount"]), reverse=True)
    return signals


# ─── 4. Circular Transfer Detection ───────────────────────────────────────────
def detect_circular_transfers(
    G: nx.MultiDiGraph,
    config: DetectorConfig = DetectorConfig(),
) -> list[dict]:
    """
    Round-trip cycles: A → B → C → A.

    Performance strategy:
      • Restrict to a tiny subgraph of the TOP-N highest-risk nodes only.
        "Highest-risk" = highest combined in+out degree (hub nodes).
      • simple_cycles on a ~80-node subgraph is nearly instantaneous.
    """
    # ── Select top-N high-degree nodes ────────────────────────────────────
    ranked = sorted(
        G.nodes(),
        key=lambda n: G.in_degree(n) + G.out_degree(n),
        reverse=True,
    )
    top_nodes = set(ranked[: config.CIRCULAR_TOP_N_NODES])
    subG = G.subgraph(top_nodes).copy()

    print(f"  [Circular] Subgraph: {subG.number_of_nodes()} nodes, "
          f"{subG.number_of_edges()} edges")

    signals: list[dict] = []
    seen: set[frozenset] = set()

    # O(k·L) DFS targeted cycle detector
    # Guarantees performance even in dense graphs by:
    # 1. Hard-bounding the recursion depth to CIRCULAR_MAX_LENGTH
    # 2. Enforcing start_node is the string-lexicographic minimum to avoid duplicate cycles
    nodes = list(subG.nodes())

    for start_node in nodes:
        if len(signals) >= config.CIRCULAR_MAX_RESULTS:
            break

        start_str = str(start_node)
        
        # Iterative DFS for cycle detection
        # Elements are: (current_path, current_set)
        path_stack: list[tuple[list[Any], set[Any]]] = [([start_node], {start_node})]

        while path_stack and len(signals) < config.CIRCULAR_MAX_RESULTS:
            current_path, current_set = path_stack.pop()
            current_node = current_path[-1]

            for neighbor in subG.successors(current_node):
                if len(signals) >= config.CIRCULAR_MAX_RESULTS:
                    break

                if neighbor == start_node and len(current_path) >= 2:
                    # Valid cycle completed!
                    cycle_len = len(current_path)
                    ck = frozenset(current_path)
                    
                    if ck not in seen:
                        seen.add(ck)
                        
                        total_amount = 0.0
                        for i in range(cycle_len):
                            a = current_path[i]
                            b = current_path[(i + 1) % cycle_len]
                            if G.has_edge(a, b):
                                total_amount += sum(edata.get("amount", 0.0) for edata in G[a][b].values())

                        length_score = max(1.0 - (cycle_len - 2) / max(config.CIRCULAR_MAX_LENGTH, 1), 0.1)
                        amount_score = min(total_amount / 50_000.0, 1.0)
                        risk_score   = round(0.50 * length_score + 0.50 * amount_score, 4)

                        signals.append({
                            "pattern":      "circular_transfer",
                            "accounts":     list(current_path),
                            "cycle_length": cycle_len,
                            "total_amount": round(total_amount, 2),
                            "risk_score":   risk_score,
                            "source_layer": "graph_intelligence",
                        })
                
                # Continue DFS path if within max length
                elif len(current_path) < config.CIRCULAR_MAX_LENGTH:
                    # Strictly enforce that start_node is the lexicographical minimum 
                    # in the current cycle being explored to prevent duplicates
                    if str(neighbor) > start_str and neighbor not in current_set:
                        new_set = set(current_set)
                        new_set.add(neighbor)
                        path_stack.append((current_path + [neighbor], new_set))

    signals.sort(key=lambda s: s["risk_score"], reverse=True)
    return signals


# ─── Prior Vector → Typology Mapping ─────────────────────────────────────────
# Maps the Context Agent's typology_focus string to the graph detectors that
# should receive relaxed (more sensitive) thresholds.
_TYPOLOGY_TO_DETECTOR = {
    "structuring":           "smurfing",
    "smurfing":              "smurfing",
    "shell_company_layering": "layering",
    "layering":              "layering",
    "round_tripping":        "circular",
    "circular":              "circular",
    "funnel":                "funnel",
    "hawala":                "funnel",
}


def _apply_prior_bias(
    config: DetectorConfig,
    prior_vector: dict | None,
) -> tuple[DetectorConfig, str | None]:
    """
    If a prior_vector is provided and its typology_focus maps to a known
    detector, return a *copy* of config with relaxed thresholds for that
    detector.  This implements the architectural requirement:
      "Typology detection biased toward active patterns in the prior vector."
    """
    if prior_vector is None:
        return config, None

    ws = prior_vector.get("world_state", {})
    typology = ws.get("typology_focus", "None")
    rm       = ws.get("risk_multiplier", 0.05)

    if typology == "None" or rm <= 0.05:
        return config, None

    target = _TYPOLOGY_TO_DETECTOR.get(typology)
    if target is None:
        return config, None

    # Create a shallow copy so we don't mutate the caller's config
    import copy
    biased = copy.copy(config)

    # Bias factor: how aggressively to relax thresholds (higher RM = more bias)
    # Scale: rm=0.5 → 20% relaxation, rm=1.0 → 40% relaxation
    bias = min(rm * 0.4, 0.5)

    if target == "smurfing":
        biased.SMURF_MIN_SENDERS    = max(3, int(config.SMURF_MIN_SENDERS    * (1 - bias)))
        biased.SMURF_MIN_TX_COUNT   = max(5, int(config.SMURF_MIN_TX_COUNT   * (1 - bias)))
        biased.SMURF_MAX_AVG_AMOUNT = config.SMURF_MAX_AVG_AMOUNT * (1 + bias)
        biased.SMURF_TOP_N          = int(config.SMURF_TOP_N * (1 + bias))

    elif target == "layering":
        biased.LAYERING_MIN_HOPS     = max(2, config.LAYERING_MIN_HOPS - 1)
        biased.LAYERING_SOURCE_TOP_K = int(config.LAYERING_SOURCE_TOP_K * (1 + bias))
        biased.LAYERING_MAX_PATHS    = int(config.LAYERING_MAX_PATHS * (1 + bias))

    elif target == "circular":
        biased.CIRCULAR_TOP_N_NODES = int(config.CIRCULAR_TOP_N_NODES * (1 + bias))
        biased.CIRCULAR_MAX_LENGTH  = min(config.CIRCULAR_MAX_LENGTH + 1, 7)
        biased.CIRCULAR_MAX_RESULTS = int(config.CIRCULAR_MAX_RESULTS * (1 + bias))

    elif target == "funnel":
        biased.FUNNEL_MIN_IN_DEGREE  = max(3, int(config.FUNNEL_MIN_IN_DEGREE  * (1 - bias)))
        biased.FUNNEL_MIN_OUT_DEGREE = max(3, int(config.FUNNEL_MIN_OUT_DEGREE * (1 - bias)))
        biased.FUNNEL_TOP_N          = int(config.FUNNEL_TOP_N * (1 + bias))

    return biased, target


# ─── Unified Runner ───────────────────────────────────────────────────────────
def run_all_detectors(
    G: nx.MultiDiGraph,
    config: DetectorConfig = DetectorConfig(),
    prior_vector: dict | None = None,
) -> dict[str, list[dict]]:
    """
    Run all four detectors and return combined results keyed by pattern name.

    If a prior_vector (from the Context Agent) is provided, the detector
    matching the typology_focus will run with relaxed thresholds — implementing
    the architectural requirement of context-biased typology detection.
    """
    biased_config, biased_target = _apply_prior_bias(config, prior_vector)

    if biased_target:
        print(f"[PatternDetectors] Prior Vector bias ACTIVE → '{biased_target}' thresholds relaxed")
    else:
        print("[PatternDetectors] No prior vector bias applied (static thresholds)")

    # Use biased config for the targeted detector, default config for others
    smurf_cfg    = biased_config if biased_target == "smurfing" else config
    funnel_cfg   = biased_config if biased_target == "funnel"   else config
    layer_cfg    = biased_config if biased_target == "layering" else config
    circular_cfg = biased_config if biased_target == "circular" else config

    print("[PatternDetectors] Running smurfing detection …")
    smurfing = detect_smurfing(G, smurf_cfg)
    print(f"  → {len(smurfing)} smurfing signals")

    print("[PatternDetectors] Running funnel account detection …")
    funnels = detect_funnel_accounts(G, funnel_cfg)
    print(f"  → {len(funnels)} funnel account signals")

    print("[PatternDetectors] Running layering detection …")
    layering = detect_layering(G, layer_cfg)
    print(f"  → {len(layering)} layering signals")

    print("[PatternDetectors] Running circular transfer detection …")
    circular = detect_circular_transfers(G, circular_cfg)
    print(f"  → {len(circular)} circular transfer signals")

    return {
        "smurfing":          smurfing,
        "funnel_accounts":   funnels,
        "layering":          layering,
        "circular_transfer": circular,
    }
