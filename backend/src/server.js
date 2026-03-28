const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const { generateSar } = require("./services/mlService");
const { upload } = require("./services/upload");
const { ingestCsvBuffer } = require("./services/csvIngest");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "sar-backend" });
});

app.post("/api/sar/generate", upload.single("transactions"), async (req, res) => {
  try {
    console.log("/api/sar/generate called", {
      hasFile: Boolean(req.file),
      fileName: req.file?.originalname,
      fileSize: req.file?.size,
    });
    if (!req.file) {
      return res.status(400).json({ error: "Missing transactions CSV file" });
    }

    const humanFeedback = req.body.human_feedback || "";
    console.log("Starting CSV ingest...");
    const ingestResult = await ingestCsvBuffer(req.file.buffer);
    console.log("CSV ingest done", ingestResult);

    console.log("Calling ML-Service...");
    const result = await generateSar({
      file: req.file,
      humanFeedback,
    });
    console.log("ML-Service completed");

    return res.json({
      ...result,
      ingest: ingestResult,
    });
  } catch (err) {
    console.error("SAR generation failed", err);
    return res.status(500).json({
      error: "SAR generation failed",
      detail: err.message || String(err),
    });
  }
});

const port = Number(process.env.PORT || 5050);
app.listen(port, () => {
  console.log(`SAR backend listening on ${port}`);
});
