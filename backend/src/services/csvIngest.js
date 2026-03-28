const { parse } = require("csv-parse/sync");
const { ensureSchema, upsertTransactions, getDbConfig } = require("./db");

function normalizeRecord(row) {
  const transaction_id = String(row.transaction_id || row.transactionId || row.id || "").trim();
  return {
    transaction_id,
    sender_account: row.sender_account || row.sender || row.from_account || "",
    receiver_account: row.receiver_account || row.receiver || row.to_account || "",
    amount: Number(row.amount || 0),
    currency: row.currency || "USD",
    timestamp: row.timestamp || row.date || null,
    country: row.country || "",
    high_risk_country: Number(row.high_risk_country || row.is_high_risk_country || 0),
    below_ctr_threshold: Number(row.below_ctr_threshold || 0),
    raw: JSON.stringify(row),
  };
}

async function ingestCsvBuffer(buffer) {
  const records = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const normalized = records.map(normalizeRecord).filter((row) => row.transaction_id);
  await ensureSchema();
  const result = await upsertTransactions(normalized);

  return {
    inserted: result.inserted,
    total: normalized.length,
    db: getDbConfig().kind,
  };
}

module.exports = { ingestCsvBuffer };
