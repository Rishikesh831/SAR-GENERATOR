import sys
import json
import requests
from typing import Dict, Any

def generate_sar(
    country: str,
    reporting_blueprint: Dict[str, Any],
    evidence_bundle: str,
    model_name: str = "llama3.2:latest"
) -> str:
    """
    Takes the rigid Reporting Blueprint (Regulatory Rules) and the exact 
    Evidence Bundle, sending an unbreakable prompt to the LLM to write 
    a highly compliant Suspicious Activity Report.
    """
    # The unbreakable prompt logic according to user requirements
    system_prompt = f"""You are a compliance officer for {country}. 
According to the uploaded guidelines, your report must follow these rules: 
{json.dumps(reporting_blueprint, indent=2)}.

Using the following Evidence Bundle: 
{evidence_bundle}

write the official narrative.
DO NOT add facts not found in the Evidence Bundle. 
If the guidelines ask for information not in the bundle, leave it as [NOT PROVIDED]."""

    # Execute against local LLM endpoint
    payload = {
        "model": model_name,
        "prompt": system_prompt,
        "stream": False
    }

    try:
        # Assumes an active Ollama process serving the specified model.
        response = requests.post("http://localhost:11434/api/generate", json=payload, timeout=300)
        response.raise_for_status()
        return response.json().get("response", "ERROR: Empty response from LLM.")
    except Exception as e:
        return f"Failed to connect to LLM or generate text: {e}"

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Generate a SAR using Blueprint and Evidence.")
    parser.add_argument("--country", required=True, help="Operating jurisdiction (e.g. 'United States', 'Singapore')")
    parser.add_argument("--blueprint", required=True, help="Path to ReportingBlueprint JSON file")
    parser.add_argument("--evidence", required=True, help="Path to EvidenceBundle JSON file")
    parser.add_argument("--model", default="llama3", help="Ollama model to use")
    
    args = parser.parse_args()
    
    try:
        with open(args.blueprint, 'r') as f:
            blueprint = json.load(f)
            
        with open(args.evidence, 'r') as f:
            evidence = f.read() # Load raw JSON string to inject into the LLM context
            
        print(f"Generating SAR for {args.country} using provided blueprints and evidence...")
        narrative = generate_sar(args.country, blueprint, evidence, args.model)
        
        print("\n" + "=" * 60)
        print("  GENERATED SUSPICIOUS ACTIVITY REPORT  ")
        print("=" * 60 + "\n")
        print(narrative)
        print("\n" + "=" * 60)
        
    except Exception as e:
        print(f"Error reading input files: {e}")
        sys.exit(1)
