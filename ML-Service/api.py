import os
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional

# Import the existing pipeline logic
from e2e_test import run_pipeline, OUT_DIR

app = FastAPI(
    title="SAR Generator ML Service API",
    description="Microservice API for running the Anti-Money Laundering 7-Layer Detection Pipeline.",
    version="1.0.0"
)

# Pydantic schema for incoming requests
class PipelineRequest(BaseModel):
    human_feedback: Optional[str] = None

class PipelineResponse(BaseModel):
    case_id: str
    narrative: str
    audit_trail: dict
    case_bundle: dict

@app.get("/")
def health_check():
    """Simple health check endpoint for Render/hosting platforms."""
    return {"status": "ok", "service": "ML-Service-API"}

@app.post("/api/v1/generate_sar", response_model=PipelineResponse)
def trigger_pipeline(request: PipelineRequest):
    """
    Triggers the entire AML pipeline (Layers 0 through 7).
    Optionally accepts a 'human_feedback' string to inject back into the Context Agent (Layer 0)
    for interactive bias tuning and overrides.
    """
    try:
        # 1. Run the actual pipeline (this generates artifacts to pipeline_outputs/)
        result = run_pipeline(human_feedback=request.human_feedback)
        case_id = result.get("case_id", "CASE-E2E-001")
        
        # 2. Extract final outputs from the generated JSON artifacts
        audit_path = os.path.join(OUT_DIR, f"L7_audit_log_{case_id}.json")
        bundle_path = os.path.join(OUT_DIR, "L4_evidence_bundle.json")
        
        audit_data = {}
        if os.path.exists(audit_path):
            with open(audit_path, "r", encoding="utf-8") as f:
                audit_data = json.load(f)
                
        bundle_data = {}
        if os.path.exists(bundle_path):
            with open(bundle_path, "r", encoding="utf-8") as f:
                bundle_data = json.load(f)
                
        # 3. Construct and return response
        return {
            "case_id": case_id,
            "narrative": result.get("narrative", ""),
            "audit_trail": audit_data,
            "case_bundle": bundle_data
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # When run directly via `python api.py`
    uvicorn.run("api:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=True)
