"""
sample_output.py
────────────────────────────────────────────────────────────────
Demonstrates the External Context Agent (Layer 2) with 4 realistic
advisory texts and prints the JSON Prior Vector for each.

Run from repo root:
    d:\\SAR-Generator\\venv\\Scripts\\python.exe ML-Service\\sample_output.py
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__))))

from external_context_agent import ContextAgent

DIVIDER = "=" * 64

# Ensure stdout handles unicode safely on Windows
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

samples = [
    {
        "label": "SAMPLE 1 — FinCEN Advisory (West Africa / narcotics / structuring)",
        "text": """\
FinCEN Advisory FIN-2025-A002: Money Laundering Threats in West Africa

FinCEN is alerting U.S. financial institutions to increased suspicious
activity involving structuring and smurfing networks operating out of
Nigeria and Ghana.  Multiple shell companies have been identified
utilizing fictitious trade invoices (trade-based money laundering) to
layer proceeds of narcotics trafficking through correspondent banking —
a pattern reminiscent of the historic HSBC pattern.

Crypto mixers (Tornado Cash clones) are being used to obfuscate final
fund destinations.  Institutions should file SARs for transactions
exhibiting below-threshold cash deposits paired with outbound wires to
offshore accounts in the Cayman Islands and British Virgin Islands.
""",
    },
    {
        "label": "SAMPLE 2 — FATF Ransomware / SE Asia Crypto Obfuscation",
        "text": """\
FATF Alert — October 2025: Ransomware groups including LockBit and
BlackCat are increasingly using crypto mixers and chain hopping to
launder proceeds through unhosted wallets and DeFi protocols.

Transaction chains end at Vietnamese and Cambodian peer-to-peer
exchanges before final off-ramp.  Business email compromise (BEC)
frequently seeds the ransomware payment cycle via wire fraud.
FATF is placing Vietnam and Cambodia under enhanced monitoring.
""",
    },
    {
        "label": "SAMPLE 3 — FATF Grey-list (Central Asia / Hawala / Laundromat)",
        "text": """\
FATF Plenary June 2025: Kazakhstan, Uzbekistan, and Moldova have been
added to the FATF Grey List due to strategic AML/CFT deficiencies.

Concerns include hawala networks enabling proliferation finance and
insufficient oversight of real estate laundering through anonymous LLC
structures.  Azerbaijani Laundromat-style mirror trade schemes have
re-emerged in the region.  Sanctions evasion via OFAC-designated
entities was also cited.
""",
    },
    {
        "label": "SAMPLE 4 — Irrelevant Text (baseline expected)",
        "text": """\
The local weather forecast for tomorrow shows heavy rainfall across
south-eastern coastal regions.  The agricultural sector expects bumper
wheat and rice harvests this year, boosting rural incomes significantly.
Commodity prices for grain are expected to stabilise by Q3 2025.
""",
    },
]

agent = ContextAgent()

for sample in samples:
    print(f"\n{DIVIDER}")
    print(f"  {sample['label']}")
    print(DIVIDER)
    vector = agent.analyze(sample["text"])
    print(vector.to_json())

print(f"\n{DIVIDER}")
print("  All samples processed successfully.")
print(DIVIDER)
