/**
 * Audit Middleware
 * Automatically logs every API action with structured audit entries
 * 
 * Log format:
 * {
 *   timestamp,
 *   layer: "USER" | "BACKEND" | "ML",
 *   action,
 *   details
 * }
 */

import { db } from "./dbconfig.js";
import { auditLogs } from "../src/db/schemas.ts";

/**
 * Express middleware that logs every request to the audit system
 */
export const auditMiddleware = (req, res, next) => {
    const startTime = Date.now();
    const originalJson = res.json.bind(res);

    // Override res.json to intercept the response
    res.json = (body) => {
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode;

        // Only audit meaningful API calls (not health checks)
        if (req.path !== "/health" && req.path !== "/") {
            logAuditEntry(req, statusCode, duration, body).catch(err => {
                console.warn("[AUDIT] Failed to log:", err.message);
            });
        }

        return originalJson(body);
    };

    next();
};

/**
 * Write audit entry to database
 */
async function logAuditEntry(req, statusCode, duration, responseBody) {
    const action = determineAction(req);
    const caseId = extractCaseId(req, responseBody);

    if (!caseId) return; // Skip if no case context

    try {
        await db.insert(auditLogs).values({
            caseId,
            action,
            actor: req.headers["x-actor"] || "SYSTEM",
            details: `${req.method} ${req.path} → ${statusCode} (${duration}ms)`,
            payload: {
                layer: determineLayer(req),
                method: req.method,
                path: req.path,
                statusCode,
                duration,
                timestamp: new Date().toISOString(),
            },
        });
    } catch (err) {
        // Silently fail — audit should never break the main flow
        console.warn("[AUDIT] DB write failed:", err.message);
    }
}

function determineAction(req) {
    const path = req.path.toLowerCase();
    const method = req.method;

    if (path.includes("ingest") && method === "POST") return "DATA_INGESTED";
    if (path.includes("analyze") && method === "POST") return "ML_ANALYSIS_TRIGGERED";
    if (path.includes("evidence") && method === "POST") return "EVIDENCE_EXTRACTED";
    if (path.includes("narrative") && method === "POST") return "NARRATIVE_GENERATED";
    if (path.includes("sar") && path.includes("generate") && method === "POST") return "SAR_GENERATED";
    if (path.includes("sar") && path.includes("save") && method === "POST") return "SAR_SAVED";
    if (path.includes("checklist") && method === "PATCH") return "CHECKLIST_UPDATED";
    if (path.includes("risk")) return "RISK_QUERIED";
    if (path.includes("analytics")) return "ANALYTICS_QUERIED";
    if (method === "PATCH") return "CASE_UPDATED";
    if (method === "DELETE") return "CASE_DELETED";
    if (method === "GET") return "DATA_QUERIED";

    return `${method}_${path.replace(/\//g, "_").toUpperCase()}`;
}

function determineLayer(req) {
    const path = req.path.toLowerCase();
    if (path.includes("sar") || path.includes("analyze") || path.includes("narrative")) return "ML";
    if (req.headers["x-actor"] && !req.headers["x-actor"].includes("SYSTEM")) return "USER";
    return "BACKEND";
}

function extractCaseId(req, responseBody) {
    // From URL params
    if (req.params?.id) return req.params.id;

    // From request body
    if (req.body?.caseId) return req.body.caseId;

    // From response body
    if (responseBody?.caseId) return responseBody.caseId;
    if (responseBody?.data?.id) return responseBody.data?.id;

    return null;
}

/**
 * Utility: Log an audit event directly (for use in services/controllers)
 */
export async function logAudit(caseId, action, actor, details, payload = {}) {
    try {
        await db.insert(auditLogs).values({
            caseId,
            action,
            actor,
            details,
            payload: {
                ...payload,
                layer: payload.layer || "BACKEND",
                timestamp: new Date().toISOString(),
            },
        });
    } catch (err) {
        console.warn("[AUDIT] Direct log failed:", err.message);
    }
}
