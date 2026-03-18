import uuid
from evidence_schema import Evidence


class EvidenceBuilder:

    def build_smurfing_evidence(
        self,
        case_id,
        accounts,
        total_amount,
        tx_count,
        avg_amount,
        start_time,
        end_time,
        risk_score
    ):

        return Evidence(

            evidence_id=str(uuid.uuid4()),
            case_id=case_id,

            evidence_type="smurfing_pattern",

            description=f"{tx_count} small transfers detected indicating structuring",

            accounts_involved=accounts,

            amount_total=total_amount,
            risk_score=risk_score,

            source_layer="graph_analysis",

            timestamp_start=start_time,
            timestamp_end=end_time,

            supporting_features={
                "transaction_count": tx_count,
                "avg_amount": avg_amount
            }
        )