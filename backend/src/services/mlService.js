const axios = require("axios");
const FormData = require("form-data");

function getMlServiceUrl() {
  return process.env.ML_SERVICE_URL || "http://localhost:8000";
}

async function generateSar({ file, humanFeedback }) {
  const form = new FormData();
  form.append("transactions_csv", file.buffer, {
    filename: file.originalname || "transactions.csv",
    contentType: file.mimetype || "text/csv",
  });
  form.append("human_feedback", humanFeedback);

  const response = await axios.post(
    `${getMlServiceUrl()}/api/v1/generate_sar`,
    form,
    { headers: form.getHeaders(), maxBodyLength: Infinity }
  );

  return response.data;
}

module.exports = { generateSar };
