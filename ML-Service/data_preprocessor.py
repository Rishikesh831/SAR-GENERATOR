import pandas as pd
import numpy as np

# A typical list of high-risk jurisdictions for AML compliance masking
HIGH_RISK_JURISDICTIONS = {
    "NG", "GH", "LR", "CY", "KY", "PA", "UAE", "SG", "CH"
}

class TransactionPreprocessor:
    """
    Layer 1.5 - Data Normalization & Feature Engineering
    Dynamically processes any inbound transaction stream (CSV or live records).
    Handles missing data, imputes defaults, filters irrelevant records, 
    and calculates exact behavioral features required by the ML/Graph Engines.
    """
    
    @staticmethod
    def filter_irrelevant_rows(df: pd.DataFrame) -> pd.DataFrame:
        """
        Removes noisy, corrupt, or irrelevant transaction rows that provide 
        no value to AML investigation or that violate fundamental logic.
        """
        initial_len = len(df)
        
        # 1. Remove rows with completely missing essential identities
        df = df.dropna(subset=["sender_account", "receiver_account"])
        
        # 2. Remove identically self-referencing transfers (A -> A)
        # In actual banking, these are usually internal wallet transfers/fees
        df = df[df["sender_account"] != df["receiver_account"]]
        
        # 3. Remove zero or negative value transactions (bounced checks, balance pings)
        df["amount"] = pd.to_numeric(df["amount"], errors="coerce").fillna(0.0)
        df = df[df["amount"] > 0.0]
        
        removed = initial_len - len(df)
        if removed > 0:
            print(f"  [Filter] Removed {removed} irrelevant or corrupt rows (Empty IDs, Self-Transfers, or <= $0).")
            
        return df.copy()

    @staticmethod
    def process(df: pd.DataFrame) -> pd.DataFrame:
        """
        Takes raw inbound transactions and returns a fully standardized DataFrame
        with all synthetic and engineered features intact.
        """
        print("[DataPreprocessor] Normalizing inbound transaction data...")
        df = df.copy()

        # 1. Standardize Core Columns & Filter
        required_core = ["sender_account", "receiver_account", "amount"]
        for col in required_core:
            if col not in df.columns:
                raise ValueError(f"CRITICAL ERROR: Inbound data missing required core column: '{col}'")
                
        # Clean irrelevant rows before feature engineering
        df = TransactionPreprocessor.filter_irrelevant_rows(df)

        if len(df) == 0:
            print("  [Warning] DataFrame is empty after filtering!")
            return df

        # 2. Standardize Timestamps
        if "timestamp" not in df.columns:
            print("  Warning: 'timestamp' missing. Defaulting to current time.")
            df["timestamp"] = pd.Timestamp.now()
        else:
            df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
            # Impute unparseable dates with current time
            df["timestamp"] = df["timestamp"].fillna(pd.Timestamp.now())

        df["_date"] = df["timestamp"].dt.date

        # 3. Engineer: 'n_daily_txns' (Frequency Feature)
        if "n_daily_txns" not in df.columns:
            print("  Engineering feature: 'n_daily_txns' (Grouping by Sender & Date)")
            daily_counts = df.groupby(["sender_account", "_date"]).size().reset_index(name="n_daily_txns")
            df = df.merge(daily_counts, on=["sender_account", "_date"], how="left")
        else:
            df["n_daily_txns"] = pd.to_numeric(df["n_daily_txns"], errors="coerce").fillna(1)

        # 4. Engineer: 'velocity_spike' (Behavioral Feature map)
        if "velocity_spike" not in df.columns:
            print("  Engineering feature: 'velocity_spike' (Thresholding daily freq)")
            df["velocity_spike"] = (df["n_daily_txns"] >= 5).astype(int)
        else:
            df["velocity_spike"] = pd.to_numeric(df["velocity_spike"], errors="coerce").fillna(0).astype(int)

        # 5. Engineer: 'high_risk_country' (Geopolitical Flag)
        if "high_risk_country" not in df.columns:
            print("  Engineering feature: 'high_risk_country' (Mapping via ISO codes)")
            if "country" in df.columns:
                df["high_risk_country"] = df["country"].str.upper().isin(HIGH_RISK_JURISDICTIONS).astype(int)
            else:
                print("    Warning: 'country' column missing. Defaulting 'high_risk_country' to 0.")
                df["high_risk_country"] = 0
        else:
            df["high_risk_country"] = pd.to_numeric(df["high_risk_country"], errors="coerce").fillna(0).astype(int)

        # 6. Engineer: 'below_ctr_threshold' (Structuring indicator)
        if "below_ctr_threshold" not in df.columns:
            print("  Engineering feature: 'below_ctr_threshold' (Structuring limits)")
            df["below_ctr_threshold"] = ((df["amount"] >= 8500) & (df["amount"] < 10000)).astype(int)
        else:
            df["below_ctr_threshold"] = pd.to_numeric(df["below_ctr_threshold"], errors="coerce").fillna(0).astype(int)

        # 7. Cleanup arbitrary temporary columns
        df = df.drop(columns=["_date"], errors="ignore")

        print(f"[DataPreprocessor] Successfully normalized {len(df)} compliant rows.")
        return df

if __name__ == "__main__":
    # Smoke Test includes corrupt/irrelevant rows
    mock_data = pd.DataFrame({
        "sender_account": ["A1", "A1", "A1", "A1", "A1", "A3", "A2", None, "A3", "A4"],
        "receiver_account": ["B1", "B2", "B3", "B4", "B5", "A3", "B1", "B1", "B9", "B4"],
        "amount": [9500, 9900, 150, 400, 9600, 100, 12000, 50, 0, -500],
        "country": ["NG", "US", "GH", "UK", "CH", "PA", "UAE", "UK", "US", "UK"],
        "timestamp": ["2026-03-27 10:00:00"] * 10
    })
    
    clean_df = TransactionPreprocessor.process(mock_data)
    print("\n--- Final Clean Output ---")
    print(clean_df[["sender_account", "receiver_account", "amount", "n_daily_txns", "high_risk_country"]])
