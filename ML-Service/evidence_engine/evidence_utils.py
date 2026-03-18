from evidence_engine.evidence_builder import EvidenceBuilder
from evidence_engine.evidence_store import EvidenceStore

builder = EvidenceBuilder()
store = EvidenceStore()

evidence = builder.build_smurfing_evidence(

    case_id="C001",
    accounts=["A120","A340","A500"],
    total_amount=28000,
    tx_count=32,
    avg_amount=875,
    start_time="2023-02-01",
    end_time="2023-02-02",
    risk_score=0.91
)

store.add(evidence)

print(store.get_all())