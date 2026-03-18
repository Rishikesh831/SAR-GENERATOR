class EvidenceStore:

    def __init__(self):
        self.evidence = []

    def add(self, evidence):
        self.evidence.append(evidence)

    def get_all(self):
        return self.evidence

    def filter_by_type(self, evidence_type):

        return [
            e for e in self.evidence
            if e.evidence_type == evidence_type
        ]