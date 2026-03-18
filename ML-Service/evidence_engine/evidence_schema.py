from dataclasses import dataclass
from typing import List, Dict

@dataclass
class Evidence:

    evidence_id: str
    case_id: str

    evidence_type: str
    description: str

    accounts_involved: List[str]

    amount_total: float
    risk_score: float

    source_layer: str

    timestamp_start: str
    timestamp_end: str

    supporting_features: Dict