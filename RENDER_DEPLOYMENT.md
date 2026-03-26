# Deployment Guide: SAR ML-Service to Render

This branch contains the newly isolated, production-ready **ML-Service Microservice**. 
By deploying this as a standalone Web Service on [Render](https://render.com/), your backend (Node.js or otherwise) can seamlessly trigger the pipeline over HTTP without needing heavy Python dependencies.

---

## 🚀 1. Preparing the Branch

Since this is just a branch, you need to ensure the structure is clear for Render to deploy correctly from GitHub:

The `ML-Service` pipeline and its requirements are wrapped inside the newly created `api.py` FastAPI endpoint.

**Commit all changes on your branch:**
```bash
git add .
git commit -m "feat: Add FastAPI wrapper for ML-Service and Render config"
git push origin <your-branch-name>
```

---

## 🌎 2. Creating the Render Web Service

1. Go to [Render.com](https://render.com) and log in.
2. Click **New +** and select **Web Service**.
3. Select **Build and deploy from a Git repository**.
4. Connect to your `SAR-Generator` GitHub repository.
5. In the configuration page, specify the branch you just pushed.

### **Crucial Render Configurations**

Fill in the settings exactly as follows:

- **Name:** `sar-ml-service` (or your preference)
- **Environment:** `Python 3`
- **Root Directory:** `ML-Service` 
*(This ensures Render treats ML-Service as the root, so it correctly resolves your relative paths and finds `api.py`.)*
- **Build Command:** `pip install -r ../requirements.txt`
*(Because requirements.txt is at the root of the repo, we use `../` since Render's working dir is now `ML-Service`.)*
- **Start Command:** `uvicorn api:app --host 0.0.0.0 --port $PORT`

### **Advanced / Additional Setup**
- **Instance Type:** Because this pipeline is running memory-intensive models like XGBoost and NetworkX, we recommend choosing at least a **Standard ($25/mo)** or **Pro** instance type to avoid Out Of Memory (OOM) failures. Free tiers will rapidly close the pipeline due to CPU ceilings.
- **Ollama Generation:** Currently, the code attempts to route SAR LLM requests to `http://localhost:11434` (Ollama). If you are deploying entirely in the cloud, you will need to replace the local Ollama usage inside `sar_generator.py` with an external cloud API key (e.g., Anthropic Claude / OpenAI / Replicate) by placing those keys into Render's **Environment Variables** (e.g., `OPENAI_API_KEY`).

---

## 🔗 3. Using the Service

Once deployed, Render will issue a URL: `https://sar-ml-service.onrender.com`.

Your existing Web application or Node.js Backend can now trigger a case run!

### **Example Axios Call (From Node.js)**

```javascript
import axios from "axios";

// 1. Trigger the AML ML-Service
const triggerPipeline = async (analystFeedback = "") => {
    try {
        const response = await axios.post("https://sar-ml-service.onrender.com/api/v1/generate_sar", {
            human_feedback: analystFeedback
        });
        
        const { case_id, narrative, case_bundle, audit_trail } = response.data;
        
        console.log(`Success! Audit Size: ${audit_trail.total_events} events.`);
        
        // 2. Save these results to your database
        // await prisma.case.create({ data: { narrative, audit_trail, ... } })
        
    } catch (error) {
        console.error("Pipeline failed:", error.message);
    }
};
```

---

## 💻 Connecting Locally via Localhost (Prototypes)

If you don't want to deploy to Render yet, you can run the API wrapper locally!

1. Open a terminal and navigate to `d:\SAR-Generator`.
2. Activate your Virtual Environment: `venv\Scripts\activate`
3. Change into `ML-Service`: `cd ML-Service`
4. Run the API: `uvicorn api:app --reload`
5. At this point, the backend is running at `http://127.0.0.1:8000`. You can hit the `http://127.0.0.1:8000/api/v1/generate_sar` endpoint directly via Postman, or point your frontend/backend to this local URL.
