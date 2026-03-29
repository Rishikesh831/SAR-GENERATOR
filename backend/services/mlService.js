/**
 * ML Service — Central Adapter Layer
 * Handles all communication with the ML API at sar-generator.onrender.com
 * 
 * DESIGN PRINCIPLES:
 * 1. Dynamic field mapping (no hardcoded ML schemas)
 * 2. Full request/response logging
 * 3. Retry with exponential backoff
 * 4. Timeout protection
 * 5. Graceful degradation on ML failure
 */

const ML_BASE_URL = process.env.ML_API_URL || "https://sar-generator.onrender.com";
const ML_TIMEOUT_MS = parseInt(process.env.ML_TIMEOUT_MS || "120000"); // 2 min default
const ML_MAX_RETRIES = parseInt(process.env.ML_MAX_RETRIES || "3");

// ─── Signal-Level Logger ─────────────────────────────────────────────────────

const mlLog = (level, message, data = null) => {
    const timestamp = new Date().toISOString();
    const prefix = `[ML][${timestamp}]`;
    switch (level) {
        case "info":
            console.log(`${prefix} ${message}`, data ? JSON.stringify(data).slice(0, 500) : "");
            break;
        case "warn":
            console.warn(`${prefix} ⚠️  ${message}`, data || "");
            break;
        case "error":
            console.error(`${prefix} ❌ ${message}`, data || "");
            break;
        case "success":
            console.log(`${prefix} ✅ ${message}`, data ? JSON.stringify(data).slice(0, 300) : "");
            break;
    }
};

// ─── Retry Logic ─────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch with retry + timeout + logging
 */
async function fetchWithRetry(url, options = {}, retries = ML_MAX_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), ML_TIMEOUT_MS);

        try {
            mlLog("info", `Request attempt ${attempt}/${retries}: ${options.method || "GET"} ${url}`);
            const startTime = Date.now();

            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);
            const duration = Date.now() - startTime;
            mlLog("info", `Response received in ${duration}ms — Status: ${response.status}`);

            if (!response.ok) {
                const errorText = await response.text().catch(() => "No body");
                mlLog("warn", `ML API returned ${response.status}: ${errorText}`);

                if (attempt < retries && response.status >= 500) {
                    const backoff = Math.pow(2, attempt) * 1000;
                    mlLog("info", `Retrying in ${backoff}ms...`);
                    await sleep(backoff);
                    continue;
                }
                throw new Error(`ML API error ${response.status}: ${errorText}`);
            }

            return response;

        } catch (error) {
            clearTimeout(timeoutId);

            if (error.name === "AbortError") {
                mlLog("error", `Request timed out after ${ML_TIMEOUT_MS}ms (attempt ${attempt}/${retries})`);
            } else {
                mlLog("error", `Request failed (attempt ${attempt}/${retries}): ${error.message}`);
            }

            if (attempt < retries) {
                const backoff = Math.pow(2, attempt) * 1000;
                mlLog("info", `Retrying in ${backoff}ms...`);
                await sleep(backoff);
            } else {
                throw error;
            }
        }
    }
}

// ─── Transform Functions ─────────────────────────────────────────────────────

/**
 * Transform backend transactions into CSV format for ML API
 * The ML API expects a CSV file upload via multipart/form-data
 */
export function transformToML(transactions, caseDisplayId) {
    mlLog("info", `Transforming ${transactions.length} transactions for ML (case: ${caseDisplayId})`);

    // Build CSV header dynamically from transaction fields
    const headers = [
        "transaction_id", "amount", "currency", "timestamp",
        "sender_account", "sender_name", "sender_country",
        "receiver_account", "receiver_name", "receiver_country",
        "category", "is_flagged", "external_tx_id"
    ];

    const rows = transactions.map((t) => {
        const sender = t.senderDetails || {};
        const receiver = t.receiverDetails || {};
        return [
            t.displayId || t.id,
            t.amount,
            t.currency || "INR",
            t.timestamp instanceof Date ? t.timestamp.toISOString() : t.timestamp,
            sender.acc_id || sender.account_id || "",
            sender.name || "",
            sender.country || "",
            receiver.acc_id || receiver.account_id || "",
            receiver.name || "",
            receiver.country || "",
            t.category || "",
            t.isFlagged ? "true" : "false",
            t.externalTxId || ""
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    mlLog("info", `CSV generated: ${rows.length} rows, ${csvContent.length} bytes`);

    return csvContent;
}

/**
 * Dynamically map ML response fields to our internal schema
 * This avoids hardcoding ML field names — we map whatever comes back
 */
export function transformFromML(mlResponse) {
    mlLog("info", "Transforming ML response to internal schema");

    // Dynamically extract known patterns from ML response
    const result = {
        // Risk scoring — look for common ML field patterns
        risk_score: extractField(mlResponse, ["risk_score", "riskScore", "score", "ml_risk_score"]),
        risk_level: extractField(mlResponse, ["risk_level", "riskLevel", "risk_category", "severity"]),

        // Patterns detected
        patterns: extractField(mlResponse, ["patterns", "detected_patterns", "typologies", "patternsObserved"]) || [],
        alerts: extractField(mlResponse, ["alerts", "flags", "red_flags", "suspicious_flags"]) || [],

        // Graph data
        graph_patterns: extractField(mlResponse, ["graph_patterns", "graph", "network", "entity_graph"]) || [],
        clusters: extractField(mlResponse, ["clusters", "cluster_ids", "fraud_clusters"]) || [],

        // Narrative
        sar_narrative: extractField(mlResponse, ["sar_narrative", "narrative", "report_narrative", "generated_narrative"]),

        // Evidence
        evidence_bundle: extractField(mlResponse, ["evidence_bundle", "evidence", "forensic_evidence"]) || [],

        // Report meta
        report_meta: extractField(mlResponse, ["report_meta", "metadata", "report_metadata"]) || {},

        // Audit trail from ML
        ml_audit_trail: extractField(mlResponse, ["audit_trail", "ml_audit", "decision_log"]) || [],

        // Raw response preserved for debugging
        _raw: mlResponse,
    };

    // Normalize risk_score to 0-1 range
    if (result.risk_score != null) {
        const score = parseFloat(result.risk_score);
        result.risk_score = score > 1 ? score / 100 : score;
    }

    // Normalize risk_level
    if (result.risk_level) {
        result.risk_level = normalizeRiskLevel(result.risk_level);
    } else if (result.risk_score != null) {
        result.risk_level = scoreToLevel(result.risk_score);
    }

    mlLog("success", `ML transform complete`, {
        risk_score: result.risk_score,
        risk_level: result.risk_level,
        patterns: result.patterns?.length || 0,
        alerts: result.alerts?.length || 0,
    });

    return result;
}

/**
 * Search for a field across multiple possible ML field names
 */
function extractField(obj, possibleKeys) {
    if (!obj || typeof obj !== "object") return null;

    // Direct match
    for (const key of possibleKeys) {
        if (obj[key] !== undefined) return obj[key];
    }

    // Nested search (one level deep)
    for (const topKey of Object.keys(obj)) {
        if (typeof obj[topKey] === "object" && obj[topKey] !== null) {
            for (const key of possibleKeys) {
                if (obj[topKey][key] !== undefined) return obj[topKey][key];
            }
        }
    }

    return null;
}

function normalizeRiskLevel(level) {
    const normalized = String(level).toUpperCase().trim();
    if (["CRITICAL", "VERY_HIGH", "EXTREME"].includes(normalized)) return "CRITICAL";
    if (["HIGH", "ELEVATED"].includes(normalized)) return "HIGH";
    if (["MEDIUM", "MODERATE"].includes(normalized)) return "MEDIUM";
    return "LOW";
}

function scoreToLevel(score) {
    if (score >= 0.85) return "CRITICAL";
    if (score >= 0.65) return "HIGH";
    if (score >= 0.4) return "MEDIUM";
    return "LOW";
}

// ─── ML API Endpoints ────────────────────────────────────────────────────────

/**
 * POST /api/v1/generate_sar — Full pipeline trigger
 * Sends CSV transactions to ML and receives full analysis
 */
export async function callMLGenerateSAR(transactions, caseDisplayId, humanFeedback = null) {
    mlLog("info", `[ML] Sending data for case ${caseDisplayId}`);

    const csvContent = transformToML(transactions, caseDisplayId);

    // Build multipart form data
    const boundary = "----MLBoundary" + Date.now();
    let body = "";

    // CSV file part
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="transactions_csv"; filename="transactions_${caseDisplayId}.csv"\r\n`;
    body += `Content-Type: text/csv\r\n\r\n`;
    body += csvContent;
    body += `\r\n`;

    // Optional human feedback
    if (humanFeedback) {
        body += `--${boundary}\r\n`;
        body += `Content-Disposition: form-data; name="human_feedback"\r\n\r\n`;
        body += humanFeedback;
        body += `\r\n`;
    }

    body += `--${boundary}--\r\n`;

    try {
        const response = await fetchWithRetry(`${ML_BASE_URL}/api/v1/generate_sar`, {
            method: "POST",
            headers: {
                "Content-Type": `multipart/form-data; boundary=${boundary}`,
            },
            body: body,
        });

        const rawResponse = await response.json();
        mlLog("success", `[ML] Response received for case ${caseDisplayId}`, {
            keys: Object.keys(rawResponse),
        });

        // Log raw ML request/response for audit
        const auditEntry = {
            timestamp: new Date().toISOString(),
            layer: "ML",
            action: "GENERATE_SAR",
            request: { caseDisplayId, transactionCount: transactions.length },
            responseKeys: Object.keys(rawResponse),
        };

        const transformed = transformFromML(rawResponse);
        mlLog("success", `[ML] Response received (risk_score=${transformed.risk_score})`);

        return {
            success: true,
            data: transformed,
            raw: rawResponse,
            audit: auditEntry,
        };

    } catch (error) {
        mlLog("error", `[ML] Failed for case ${caseDisplayId}: ${error.message}`);

        return {
            success: false,
            data: null,
            error: error.message,
            audit: {
                timestamp: new Date().toISOString(),
                layer: "ML",
                action: "GENERATE_SAR_FAILED",
                error: error.message,
            },
        };
    }
}

/**
 * GET /api/v1/evidence — Retrieve ML evidence bundle
 */
export async function callMLGetEvidence() {
    mlLog("info", "[ML] Fetching evidence bundle");

    try {
        const response = await fetchWithRetry(`${ML_BASE_URL}/api/v1/evidence`, {
            method: "GET",
        });

        const rawResponse = await response.json();
        mlLog("success", "[ML] Evidence bundle received");

        return {
            success: true,
            data: rawResponse,
        };
    } catch (error) {
        mlLog("error", `[ML] Evidence fetch failed: ${error.message}`);
        return { success: false, data: null, error: error.message };
    }
}

/**
 * GET /api/v1/sar_report — Retrieve full SAR report from ML
 */
export async function callMLGetSARReport() {
    mlLog("info", "[ML] Fetching SAR report");

    try {
        const response = await fetchWithRetry(`${ML_BASE_URL}/api/v1/sar_report`, {
            method: "GET",
        });

        const rawResponse = await response.json();
        mlLog("success", "[ML] SAR report received");

        return {
            success: true,
            data: rawResponse,
        };
    } catch (error) {
        mlLog("error", `[ML] SAR report fetch failed: ${error.message}`);
        return { success: false, data: null, error: error.message };
    }
}

/**
 * GET /api/v1/audit_trail — Retrieve ML decision audit log
 */
export async function callMLGetAuditTrail() {
    mlLog("info", "[ML] Fetching ML audit trail");

    try {
        const response = await fetchWithRetry(`${ML_BASE_URL}/api/v1/audit_trail`, {
            method: "GET",
        });

        const rawResponse = await response.json();
        mlLog("success", "[ML] Audit trail received");

        return {
            success: true,
            data: rawResponse,
        };
    } catch (error) {
        mlLog("error", `[ML] Audit trail fetch failed: ${error.message}`);
        return { success: false, data: null, error: error.message };
    }
}

/**
 * GET /api/v1/health/detailed — Check ML API health
 */
export async function checkMLHealth() {
    try {
        const response = await fetchWithRetry(`${ML_BASE_URL}/`, {
            method: "GET",
        }, 1); // Single attempt for health check

        const data = await response.json();
        return { healthy: true, data };
    } catch (error) {
        return { healthy: false, error: error.message };
    }
}
