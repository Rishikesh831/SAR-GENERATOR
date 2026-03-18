# Graph Intelligence Engine

This module serves as Layer 4 of the Artificial Intelligence Investigation Pipeline, functioning as the **Transaction Graph Intelligence Engine**. It converts flat transaction histories into directed, relationship-based financial graphs. 

Its primary focus is to discover distinct topological anomalies tied to Anti-Money Laundering (AML) standards.

---

## Pattern Detection Suite

Our suite parses subgraphs across varying topological characteristics, uncovering four highly targeted money-laundering typologies:

1. **Smurfing (Fan-in):** Many distinct senders funneling small amounts into a single aggregator account.
2. **Funnel Accounts (High-Throughput Pass-throughs):** Hub accounts exhibiting both severe in-degree and high out-degree that strictly channel cash immediately instead of holding it.
3. **Layering (Transfers Chain):** Rapid, multi-hop transaction chains heavily layered to bury the origin and origin account of questionable funds.
4. **Circular Transfers (Round-trip Return):** Funds eventually arriving back at their sender after jumping across many external intermediate accounts intended to wipe lineage tracking.

---

## Algorithmic Optimizations & Runtime Characteristics

The fundamental challenge with financial graph processing lies in **graph density**. Our `pattern_detectors` evaluate graphs with upwards of 200,000 transactions matching roughly 200,000 edges mapped across tiny, concentrated subsets of highly-active accounts.

### $O(k \cdot L)$ DFS-based Circular Transfer Detection

Detecting simple cycles (e.g., A $\rightarrow$ B $\rightarrow$ C $\rightarrow$ A) inside hyper-dense subgraphs creates exponential state-space explosions. Our engine strictly avoids naive topological cycle evaluation (e.g., Johnson's algorithm $O((V+E)(C+1))$ commonly used by generic libraries such as `networkx.simple_cycles`), which violently degrades when parsing short cycles scattered heavily in dense graphs.

We implemented an iterative, heavily constrained **Depth First Search (DFS) Cycle Tracker**, enforcing constant temporal growth with $O(k \cdot L)$ behavior, bounded natively by configuration thresholds: 
- $k$ represents the user-configured hard-cap on returned cycles (`CIRCULAR_MAX_RESULTS`).
- $L$ denotes the recursion chain-depth boundary (`CIRCULAR_MAX_LENGTH`).

#### Guarantees Configured:
- **String-Lexicographical Roots:** To avoid processing indistinguishable permutations of the exact same cycle offsets (e.g., A $\rightarrow$ B $\rightarrow$ C $\rightarrow$ A natively being B $\rightarrow$ C $\rightarrow$ A $\rightarrow$ B on the next iteration), the algorithm enforces mathematical string checks. The exact cycle starting node (`start_str`) must remain the absolute strict lexical minimum throughout the entirety of its component sequence.
- **Deep Pruning limits:** Recursion paths artificially collapse if their path sequence breaks the `CIRCULAR_MAX_LENGTH` limit (usually defaulting to a size of `5`), halting million-node deep walks before they manifest.
- **Early-Exits:** The iterative while-loop natively short-circuits traversal as soon as `len(signals) >= CIRCULAR_MAX_RESULTS`.

---

## Network-Level Feature Extraction (`graph_features.py`)

In parallel to isolated anomaly detection, Layer 4 automatically extracts generalized topological features for every associated account in the subgraph. These metrics construct foundational context for supervised ML Models (e.g., XGBoost, Random Forest) trained to identify complex typological blend risks.

Computed features across nodes include:
- `in_degree` & `out_degree`: Distinct connections counting independent senders and receivers.
- `in_strength` & `out_strength`: Raw monetary volume funneled through accounts.
- `in_out_ratio` & `strength_ratio`: Engineered mathematical signatures defining pass-through/funnel metrics.
- `pagerank`: Measures structural monetary centrality in the network.
- `betweenness_centrality`: Identifies crucial "bridge" accounts mathematically routing bulk volume between distinct laundering clusters.
- `clustering_coefficient`: Measures the structural density of an account's immediate neighborhood. 

---

## Programmatic Interface & Execution (`graph_pipeline.py`)

The overarching orchestration sits within `graph_pipeline.py`, bridging data loading, graph building, anomaly detection, and feature extraction.

### Standalone Orchestration
The pipeline can run autonomously without downstream layers for fast pattern scanning and local CSV extraction:
```bash
python graph_engine/graph_pipeline.py
```
Outputs:
- `outputs/graph_signals.json`: Contains structured anomaly topologies (Smurfing, Funnels, Circular Transfers, Layering).
- `outputs/graph_features.csv`: Network metric dump per account.

### Embedded Orchestration (Upstream Layer 5 Consumption)
For integrated system environments, Layer 5 (Evidence Builder) natively imports the engine:
```python
from graph_engine.graph_pipeline import GraphPipeline

engine = GraphPipeline(csv_path="transactions.csv", case_id="AML-X")
result = engine.run()

signals = result["signals"]         # Topologically flagged entities
node_features = result["features_df"] # DataFrame map of metrics
```
