"""
intelligence_kb.py
───────────────────
Static knowledge-base of AML signals used by the context agent's
NLP extraction pipeline.

Each dictionary maps a *canonical label* to a list of keyword/phrase
patterns (all lowercase).  The extractor does a case-insensitive substring
search across normalized input text.

Extending: simply add new entries to any dict.  No other code changes needed.
"""

from __future__ import annotations

# ─── Geographic Risk Regions ──────────────────────────────────────────────────
# Regions consistently flagged in FinCEN advisories, FATF grey/black lists,
# OFAC notices, and BIS Entity Lists.
REGION_PATTERNS: dict[str, list[str]] = {
    "West Africa": [
        "west africa", "nigeria", "ghana", "ivory coast", "côte d'ivoire",
        "senegal", "liberia", "sierra leone", "benin", "togo",
        "money mule", "romance scam",
    ],
    "SE Asia": [
        "southeast asia", "se asia", "myanmar", "laos", "cambodia",
        "vietnam", "thailand", "malaysia", "pig butchering",
        "crypto fraud hub", "scam compound",
    ],
    "Middle East & North Africa": [
        "mena", "hawala", "iran", "syria", "yemen", "lebanon",
        "hezbollah", "hamas", "iraq",
    ],
    "Eastern Europe": [
        "eastern europe", "ukraine", "russia", "belarus", "moldova",
        "moldova scheme", "russian oligarch", "smurfing network",
    ],
    "Caribbean / Offshore": [
        "offshore", "cayman", "british virgin islands", "bvi",
        "panama", "bahamas", "bermuda", "shell company",
    ],
    "Latin America": [
        "cartel", "sinaloa", "jalisco", "colombia", "mexico",
        "venezuela", "bolivia", "trade-based money laundering",
        "black market peso exchange", "bmpe",
    ],
    "Central Asia": [
        "central asia", "kazakhstan", "uzbekistan", "tajikistan",
        "hawala network",
    ],
}

# ─── Money-Laundering Typologies ─────────────────────────────────────────────
TYPOLOGY_PATTERNS: dict[str, list[str]] = {
    "structuring": [
        "structuring", "smurfing", "sub-threshold", "below threshold",
        "cash deposits", "multiple small transactions",
        "below reporting limit", "ctr avoidance",
    ],
    "trade_based_ml": [
        "trade-based money laundering", "tbml", "over-invoicing",
        "under-invoicing", "phantom shipment", "false declaration",
        "commodity smuggling", "import export fraud",
    ],
    "shell_company_layering": [
        "shell company", "shell corporation", "nominee director",
        "bearer shares", "layering", "beneficial owner", "ownership obfuscation",
        "fictitious company", "front company",
    ],
    "crypto_obfuscation": [
        "crypto mixer", "tumbler", "chain hopping", "defi",
        "decentralized exchange", "unhosted wallet", "tornado cash",
        "coinjoin", "privacy coin", "monero", "zcash",
        "peer-to-peer cryptocurrency",
    ],
    "real_estate_ml": [
        "real estate laundering", "all-cash purchase", "property flip",
        "luxury property", "anonymous llc", "land purchase",
    ],
    "funnel_account": [
        "funnel account", "mule account", "money mule", "third-party account",
        "drop account", "conduit account",
    ],
    "round_tripping": [
        "round trip", "back-to-back loan", "circular transfer",
        "loan back", "boomerang transaction",
    ],
    "hawala": [
        "hawala", "informal value transfer", "hundi",
        "underground banking", "fei-chien",
    ],
    "tax_evasion": [
        "tax evasion", "tax fraud", "unreported income",
        "offshore tax haven", "undisclosed foreign account", "fbar",
    ],
}

# ─── High-Risk Commodities ────────────────────────────────────────────────────
COMMODITY_PATTERNS: dict[str, list[str]] = {
    "narcotics": [
        "narcotics", "drug trafficking", "cocaine", "heroin", "fentanyl",
        "methamphetamine", "meth", "opioid", "cannabis trafficking",
        "drug cartel", "dea seizure",
    ],
    "human_trafficking": [
        "human trafficking", "forced labor", "sex trafficking",
        "modern slavery", "exploitation", "smuggling migrants",
    ],
    "arms_trafficking": [
        "arms trafficking", "weapons smuggling", "illegal firearms",
        "military equipment", "dual-use goods",
    ],
    "gold_precious_metals": [
        "gold", "precious metals", "conflict minerals", "artisanal mining",
        "gold smuggling", "silver", "platinum",
    ],
    "crypto": [
        "bitcoin", "ethereum", "cryptocurrency", "crypto", "stablecoin",
        "tether", "usdt", "usdc", "nft laundering", "defi protocol",
    ],
    "luxury_goods": [
        "luxury goods", "high-value goods", "art", "wine investment",
        "jewelry", "watch", "handbag",
    ],
    "wildlife_trafficking": [
        "wildlife trafficking", "ivory", "rhino horn", "illegal wildlife",
        "cites violation",
    ],
}

# ─── Enforcement Patterns (named technical schemes) ──────────────────────────
ENFORCEMENT_PATTERNS: dict[str, list[str]] = {
    "HSBC_pattern": [
        "hsbc pattern", "hsbc", "correspondent banking abuse",
        "nostro account", "vostro account", "payable through account",
    ],
    "Azerbaijani_Laundromat": [
        "azerbaijani laundromat", "laundromat", "moldovan scheme",
        "mirror trade", "deutsche bank mirror",
    ],
    "FinCEN_Files_pattern": [
        "fincen files", "sar filing", "suspicious activity report",
        "fincen advisory", "fincen alert",
    ],
    "Pig_Butchering": [
        "pig butchering", "sha zhu pan", "investment scam",
        "romantic investment fraud",
    ],
    "BEC_pattern": [
        "business email compromise", "bec", "ceo fraud",
        "invoice fraud", "wire fraud",
    ],
    "Sanctions_Evasion": [
        "sanctions evasion", "ofac", "sdn list", "specially designated",
        "blocked entity", "sanctions circumvention",
        "oil sanctions", "iran sanctions",
    ],
    "Ransomware_ML": [
        "ransomware", "ransomware payment", "crypto ransom",
        "lockbit", "blackcat", "cl0p", "darkside",
    ],
    "Trade_Misinvoicing": [
        "misinvoicing", "customs fraud", "customs declaration",
        "trade misinvoicing",
    ],
    "TBML_Textile": [
        "textile smuggling", "garment industry", "clothing export",
        "under-invoiced goods",
    ],
}

# ─── Relevance keywords (any hit = non-trivial financial crime context) ────────
RELEVANCE_KEYWORDS: list[str] = [
    "money laundering", "aml", "financial crime", "illicit finance",
    "suspicious activity", "terror financing", "proliferation finance",
    "fraud", "bribery", "corruption", "sanctions", "ofac", "fincen",
    "fatf", "kleptocracy", "embezzlement", "wire fraud", "bank fraud",
    "ponzi", "pyramid scheme", "insider trading",
]
