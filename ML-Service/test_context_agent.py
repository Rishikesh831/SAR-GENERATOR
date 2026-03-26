"""
test_context_agent.py
──────────────────────
Self-contained test runner for the External Context Agent (Layer 2).

Run from the ML-Service directory:
    python test_context_agent.py

Or from the repo root:
    python ML-Service/test_context_agent.py

Tests
-----
  1. Irrelevant text → baseline risk_multiplier = 0.05
  2. FinCEN High-Risk Advisory → multi-signal, high risk_multiplier
  3. Crypto obfuscation notice → typology + commodity + enforcement
  4. FATF Grey-list Region Update → region-heavy signal
  5. Batch mode → list of PriorVectors

Exit code: 0 on all pass, 1 on any failure.
"""

from __future__ import annotations

import json
import sys
import os

# ── Path resolution (works from any CWD) ─────────────────────────────────────
THIS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, THIS_DIR)

from external_context_agent import ContextAgent  # noqa: E402


# ─── ANSI helpers ────────────────────────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
RESET  = "\033[0m"
BOLD   = "\033[1m"

_passed = 0
_failed = 0


def _check(label: str, condition: bool, detail: str = "") -> None:
    global _passed, _failed
    if condition:
        print(f"  {GREEN}✔{RESET}  {label}")
        _passed += 1
    else:
        print(f"  {RED}✘{RESET}  {label}  ← {detail}")
        _failed += 1


def _header(title: str) -> None:
    print(f"\n{BOLD}{YELLOW}{'─'*60}{RESET}")
    print(f"{BOLD}{YELLOW}  {title}{RESET}")
    print(f"{BOLD}{YELLOW}{'─'*60}{RESET}")


# ─── Test cases ───────────────────────────────────────────────────────────────
AGENT = ContextAgent(timestamp_override="2026-03-25T12:00:00Z")


# ── Test 1: Irrelevant text ───────────────────────────────────────────────────
_header("TEST 1 — Irrelevant text (baseline)")

TEXT_IRRELEVANT = """\
The local weather forecast for tomorrow shows heavy rainfall across the
south-eastern coastal regions.  The agricultural sector expects bumper
wheat and rice harvests this year, boosting rural incomes significantly.
"""

v1 = AGENT.analyze(TEXT_IRRELEVANT)
print(v1.to_json())
_check("risk_multiplier == 0.05", v1.risk_multiplier == 0.05,
       f"got {v1.risk_multiplier}")
_check("region_risk == 'Undetermined'", v1.region_risk == "Undetermined")
_check("typology_focus == 'None'",      v1.typology_focus == "None")
_check("commodity_flag == 'None'",      v1.commodity_flag == "None")
_check("enforcement_rec == 'None'",     v1.enforcement_rec == "None")


# ── Test 2: FinCEN Advisory — high-density signal ─────────────────────────────
_header("TEST 2 — FinCEN Advisory (multi-signal, high risk)")

TEXT_FINCEN = """\
FinCEN Advisory FIN-2025-A002: Emerging Money Laundering Threats in West Africa

FinCEN is alerting U.S. financial institutions to increased suspicious activity
involving structuring and smurfing networks operating out of Nigeria and Ghana.
Multiple shell companies have been identified utilizing fictitious trade invoices
(trade-based money laundering) to layer proceeds of narcotics trafficking through
correspondent banking channels — a pattern reminiscent of the historic HSBC pattern.

Additionally, crypto mixers (Tornado Cash clones) are being leveraged to obfuscate
final destinations of illicit funds.  Institutions should file SARs for transactions
exhibiting below-threshold cash deposits paired with outbound wire transfers to
offshore jurisdiction accounts in the Cayman Islands and British Virgin Islands.
"""

v2 = AGENT.analyze(TEXT_FINCEN)
print(v2.to_json())
_check("risk_multiplier >= 0.75", v2.risk_multiplier >= 0.75,
       f"got {v2.risk_multiplier}")
_check("region contains West Africa",
       "West Africa" in v2.region_risk or "Caribbean" in v2.region_risk,
       f"got '{v2.region_risk}'")
_check("typology_focus is not None",
       v2.typology_focus not in ("None", "Undetermined"))
_check("commodity_flag == 'narcotics'",
       v2.commodity_flag == "narcotics",
       f"got '{v2.commodity_flag}'")
_check("enforcement_rec references HSBC_pattern",
       "HSBC" in v2.enforcement_rec,
       f"got '{v2.enforcement_rec}'")
_check("JSON is valid",
       json.loads(v2.to_json()) is not None)


# ── Test 3: Crypto-focused enforcement notice ─────────────────────────────────
_header("TEST 3 — Crypto Obfuscation / Ransomware notice")

TEXT_CRYPTO = """\
FATF Alert — October 2025: The Financial Action Task Force has identified that
ransomware groups including LockBit and BlackCat are increasingly using crypto
mixers and chain hopping techniques to launder proceeds.  Transaction chains
traverse unhosted wallets, DeFi protocols, and privacy coins (Monero, Zcash)
before being off-ramped through Vietnamese and Cambodian peer-to-peer exchanges.
Business email compromise (BEC) is frequently used to initiate wire fraud that
seeds the ransomware payment cycle.  FATF is placing Vietnam and Cambodia under
enhanced monitoring.
"""

v3 = AGENT.analyze(TEXT_CRYPTO)
print(v3.to_json())
_check("risk_multiplier >= 0.60", v3.risk_multiplier >= 0.60,
       f"got {v3.risk_multiplier}")
_check("typology_focus is crypto_obfuscation or ransomware adjacent",
       v3.typology_focus in ("crypto_obfuscation", "structuring",
                              "shell_company_layering", "round_tripping"),
       f"got '{v3.typology_focus}'")
_check("SE Asia region detected",
       "SE Asia" in v3.region_risk,
       f"got '{v3.region_risk}'")
_check("enforcement includes Ransomware or BEC",
       "Ransomware" in v3.enforcement_rec or "BEC" in v3.enforcement_rec,
       f"got '{v3.enforcement_rec}'")


# ── Test 4: FATF grey-list update (region-heavy, no commodity) ───────────────
_header("TEST 4 — FATF Grey-list Region Update")

TEXT_FATF = """\
FATF Plenary, June 2025: The following jurisdictions have been added to the
FATF Grey List due to strategic AML/CFT deficiencies: Kazakhstan, Uzbekistan,
and Moldova.  Concerns include hawala networks enabling money laundering and
proliferation finance, and insufficient oversight of real estate laundering
through anonymous LLC structures.  The Azerbaijani Laundromat-style mirror
trade schemes have re-emerged in the region.
"""

v4 = AGENT.analyze(TEXT_FATF)
print(v4.to_json())
_check("risk_multiplier >= 0.50", v4.risk_multiplier >= 0.50,
       f"got {v4.risk_multiplier}")
_check("region detected", v4.region_risk != "Undetermined",
       f"got '{v4.region_risk}'")
_check("typology hawalah or real_estate detected",
       v4.typology_focus in ("hawala", "real_estate_ml", "shell_company_layering"),
       f"got '{v4.typology_focus}'")
_check("enforcement references Azerbaijani_Laundromat",
       "Azerbaijani" in v4.enforcement_rec,
       f"got '{v4.enforcement_rec}'")


# ── Test 5: Batch mode ────────────────────────────────────────────────────────
_header("TEST 5 — Batch mode (3 texts)")

vectors = AGENT.analyze_batch([TEXT_IRRELEVANT, TEXT_FINCEN, TEXT_CRYPTO])
_check("batch returns 3 vectors", len(vectors) == 3, f"got {len(vectors)}")
_check("batch[0] is baseline", vectors[0].risk_multiplier == 0.05)
_check("batch[1] risk > batch[0] risk",
       vectors[1].risk_multiplier > vectors[0].risk_multiplier)
_check("batch[2] risk > batch[0] risk",
       vectors[2].risk_multiplier > vectors[0].risk_multiplier)


# ── Test 6: Schema compliance ─────────────────────────────────────────────────
_header("TEST 6 — JSON schema compliance")

d = v2.to_dict()
_check("has 'context_timestamp'", "context_timestamp" in d)
_check("has 'world_state'",       "world_state" in d)
_check("has 'justification'",     "justification" in d)

ws = d["world_state"]
_check("world_state has region_risk",     "region_risk"     in ws)
_check("world_state has typology_focus",  "typology_focus"  in ws)
_check("world_state has commodity_flag",  "commodity_flag"  in ws)
_check("world_state has enforcement_rec", "enforcement_rec" in ws)
_check("world_state has risk_multiplier", "risk_multiplier" in ws)
_check("risk_multiplier is float",
       isinstance(ws["risk_multiplier"], float))
_check("risk_multiplier in [0.0, 1.0]",
       0.0 <= ws["risk_multiplier"] <= 1.0)
_check("no extra top-level keys",
       set(d.keys()) == {"context_timestamp", "world_state", "justification"})


# ─── Summary ─────────────────────────────────────────────────────────────────
print(f"\n{'═'*60}")
total = _passed + _failed
print(f"  Results: {GREEN}{_passed} passed{RESET}  /  "
      f"{RED}{_failed} failed{RESET}  /  {total} total")
print("═"*60)

sys.exit(0 if _failed == 0 else 1)
