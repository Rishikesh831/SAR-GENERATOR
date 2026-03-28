import json
import pandas as pd
import os

def evaluate():
    print("Evaluating Graph Intelligence Accuracy...")
    
    # Paths
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dataset_path = os.path.join(base_dir, "..", "Dataset", "synthetic_aml_transactions.csv")
    signals_path = os.path.join(base_dir, "pipeline_outputs", "L3_graph_signals.json")
    
    if not os.path.exists(dataset_path) or not os.path.exists(signals_path):
        print(f"Missing files.\\nDataset: {dataset_path}\\nSignals: {signals_path}")
        return
        
    print(f"Loading dataset from: {dataset_path}")
    df = pd.read_csv(dataset_path)
    
    with open(signals_path, "r", encoding="utf-8") as f:
        signals = json.load(f)
        
    print("\n--- GRAPH INTELLIGENCE ACCURACY REPORT ---")
    
    # Evaluate Smurfing
    if "smurfing" in signals:
        # True Smurfing accounts (receivers of smurfing transactions)
        true_smurfs = set(df[df["pattern"] == "smurfing"]["receiver_account"].unique())
        
        # Predicted Smurfing accounts
        pred_smurfs = set([sig["account"] for sig in signals["smurfing"]])
        
        tp = len(pred_smurfs.intersection(true_smurfs))
        fp = len(pred_smurfs) - tp
        fn = len(true_smurfs) - tp
        
        precision = tp / len(pred_smurfs) if len(pred_smurfs) > 0 else 0
        recall = tp / len(true_smurfs) if len(true_smurfs) > 0 else 0
        
        print(f"\nTypology: SMURFING")
        print(f"  True Subgraphs in Dataset: {len(true_smurfs)}")
        print(f"  Detected by Graph (Biased): {len(pred_smurfs)}")
        print(f"  True Positives  : {tp}")
        print(f"  False Positives : {fp}")
        print(f"  False Negatives : {fn}")
        print(f"  Precision : {precision:.1%}")
        print(f"  Recall    : {recall:.1%}")
        
    # Evaluate Funnel Accounts
    if "funnel_accounts" in signals:
        true_funnels = set(df[df["pattern"] == "funnel"]["sender_account"].unique()).union(
                       set(df[df["pattern"] == "funnel"]["receiver_account"].unique()))
        # Some variation might exist in the dataset label, let's just check is_suspicious for funneling accounts
        pred_funnels = set([sig["funnel_account"] for sig in signals["funnel_accounts"] if "funnel_account" in sig])
        
        # If true_funnels is empty from 'funnel', let's check 'funnel_account'
        if len(true_funnels) == 0:
             true_funnels = set(df[df["pattern"] == "funnel_account"]["sender_account"].unique()).union(
                            set(df[df["pattern"] == "funnel_account"]["receiver_account"].unique()))

        tp = len(pred_funnels.intersection(true_funnels))
        precision = tp / len(pred_funnels) if len(pred_funnels) > 0 else 0
        recall = tp / len(true_funnels) if len(true_funnels) > 0 else 0
        
        print(f"\nTypology: FUNNEL ACCOUNTS")
        print(f"  True Subgraphs in Dataset: {len(true_funnels)}")
        print(f"  Detected by Graph: {len(pred_funnels)}")
        print(f"  Precision : {precision:.1%}")
        print(f"  Recall    : {recall:.1%}")

if __name__ == "__main__":
    evaluate()
