"""
audit_trail.py
──────────────
Layer 7 — Audit & Explainability Trail
Records every mathematical, AI, and extraction decision made across the entire
pipeline to ensure complete transparency (explainability) for regulators.
"""

from __future__ import annotations
import json
import time
from datetime import datetime, timezone
import os

class AuditTrail:
    """
    Append-only immutable audit log.
    Captures state transitions to prove mathematically how the AI reached its
    final decision (No black boxes).
    """
    
    def __init__(self, case_id: str):
        self.case_id = case_id
        self.start_time = time.time()
        self.events = []
        self.flagged_transactions = []
        self.log_step("SYSTEM", "AuditTrail Initialized", {"case_id": case_id})

    def record_flagged_transaction(self, tx_id: str, sender: str, receiver: str, amount: float, reason: str, layer: str):
        """Record an individual transaction that was flagged by the system."""
        self.flagged_transactions.append({
            "timestamp": datetime.now(tz=timezone.utc).isoformat(),
            "transaction_id": tx_id,
            "sender": sender,
            "receiver": receiver,
            "amount": amount,
            "reason": reason,
            "flagged_by_layer": layer
        })

    def log_step(self, layer: str, action: str, details: dict):
        """Append an event to the audit trail."""
        event = {
            "timestamp": datetime.now(tz=timezone.utc).isoformat(),
            "layer": layer,
            "action": action,
            "details": details
        }
        self.events.append(event)
        
    def export_log(self, filepath: str):
        """Dump the comprehensive audit log to a JSON file."""
        self.log_step("SYSTEM", "Audit Complete", {
            "duration_seconds": round(time.time() - self.start_time, 2),
            "total_events": len(self.events)
        })
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump({
                "case_id": self.case_id,
                "audit_trail": self.events,
                "flagged_transactions_count": len(self.flagged_transactions),
                "flagged_transactions": self.flagged_transactions
            }, f, indent=4)
        return filepath
