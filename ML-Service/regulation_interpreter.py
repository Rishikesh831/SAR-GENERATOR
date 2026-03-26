import sys
import json
import requests
from pathlib import Path

def extract_text_from_file(file_path: str) -> str:
    path = Path(file_path)
    extension = path.suffix.lower()
    
    text = ""
    if extension == '.pdf':
        try:
            import fitz  # PyMuPDF
            with fitz.open(file_path) as doc:
                text = chr(10).join(page.get_text() for page in doc)
        except ImportError:
            raise ImportError("PyMuPDF (fitz) is not installed. Please run: pip install pymupdf")
            
    elif extension in ['.html', '.htm']:
        try:
            from bs4 import BeautifulSoup
            with open(file_path, 'r', encoding='utf-8') as f:
                soup = BeautifulSoup(f.read(), 'html.parser')
                text = soup.get_text(separator='\n', strip=True)
        except ImportError:
            raise ImportError("BeautifulSoup4 is not installed. Please run: pip install beautifulsoup4")
            
    else:
        # Fallback for plain text files
        with open(file_path, 'r', encoding='utf-8') as f:
            text = f.read()
            
    return text

def extract_reporting_requirements(file_path: str, model_name: str = "llama3") -> dict:
    """
    Reads a regulatory document (PDF/HTML), extracts the text, and queries Ollama 
    to extract the 'Instructional Logic' as a JSON ReportingBlueprint.
    """
    text = extract_text_from_file(file_path)
    
    prompt = f"""
Analyze the following regulatory guidelines for Suspicious Activity Reporting (SAR).
Extract the mandatory structure, specific keywords, and stylistic requirements. 
Do not summarize the document. Extract the logical instructions needed for a machine 
to write a compliant report.

Output strictly as a valid JSON object called "ReportingBlueprint", following this schema:
{{
  "mandatory_sections": ["list of section headers"],
  "required_keywords": ["list of exact keywords requested by guideline"],
  "stylistic_rules": ["list of formatting or tone rules, e.g. 'Use passive voice'"]
}}

Document Text:
{text[:15000]}  # Truncating to avoid massive context window limits if too large
"""

    payload = {
        "model": model_name,
        "prompt": prompt,
        "format": "json",
        "stream": False
    }

    try:
        # Assuming local Ollama instance
        response = requests.post("http://localhost:11434/api/generate", json=payload, timeout=120)
        response.raise_for_status()
        result_json = response.json().get("response", "{}")
        
        # Parse the JSON response strictly
        blueprint = json.loads(result_json)
        return blueprint
        
    except requests.exceptions.RequestException as e:
        print(f"Error querying Ollama: {e}")
        return {}
    except json.JSONDecodeError as e:
        print(f"Error parsing Ollama JSON output: {e}\nRaw output: {result_json}")
        return {}

if __name__ == "__main__":
    # Test script if executed directly
    if len(sys.argv) > 1:
        file_to_parse = sys.argv[1]
        print(f"Extracting blueprint from {file_to_parse}...")
        blueprint = extract_reporting_requirements(file_to_parse)
        print(json.dumps(blueprint, indent=2))
    else:
        print("Usage: python regulation_interpreter.py <path_to_pdf_or_html>")
