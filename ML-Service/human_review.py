"""
human_review.py
───────────────
Layer 6 — Human Feedback & Re-Trigger Loop

Prompts human intervention to validate output, log corrections to the Audit Trail,
and retry pipeline operations if output is inadequate.
"""
import sys

from typing import Dict, Any

def review_sar_interactive(narrative: str, case_id: str) -> Dict[str, Any]:
    """
    Displays the generated SAR, prompts the human to review it, and accepts
    feedback if rejected.
    Returns: {"status": "approved" | "rejected", "feedback": str}
    """
    print("\n" + "=" * 60)
    print(f"  HUMAN REVIEW REQUIRED FOR CASE {case_id}")
    print("=" * 60)
    print("Please review the generated SAR narrative below:\n")
    print(narrative)
    print("\n" + "-" * 60)
    
    while True:
        choice = input("Approve this SAR for filing? (Y/N): ").strip().lower()
        if choice in ['y', 'yes', 'approve']:
            print("SAR Approved.")
            return {"status": "approved", "feedback": ""}
        elif choice in ['n', 'no', 'reject']:
            feedback = input("Why was this rejected? Please provide detailed feedback for the AI:\n>> ").strip()
            return {"status": "rejected", "feedback": feedback}
        else:
            print("Invalid input. Please enter 'Y' or 'N'.")
            
    return {"status": "error", "feedback": "escaped loop unexpectedly"}

