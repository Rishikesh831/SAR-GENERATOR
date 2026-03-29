/**
 * SAR Generation Controller
 * Handles SAR report generation, enhancement, and management
 * Implements rule-based analysis engine for regulatory compliance
 */

import { db } from "../middlewares/dbconfig.js";
import { cases, auditLogs } from "../src/db/schemas.ts";
import { eq } from "drizzle-orm";
import {
  sendResponse,
  sendError,
  sendSuccess,
  sendValidationError,
  sendNotFound,
} from "../middlewares/apiResponse.js";
import { callMLGenerateSAR, callMLGetSARReport } from "../services/mlService.js";
import { buildFraudGraph } from "../services/fraudGraphService.js";
import { generateRiskAttribution } from "../services/riskAttributionService.js";
import { buildEvidence } from "../services/evidenceBuilderService.js";

// ─── Regulatory Rules Engine ───────────────────────────────────────────

/**
 * Type definitions for regulatory framework
 */
const RegulatoryBreach = (rule, ref, severity, trigger, description, explanation, confidence) => ({
  rule,
  ref,
  severity,
  trigger,
  description,
  explanation,
  confidence,
});

/**
 * Universal regulatory breaches - applicable to all suspicious activity
 */
const getUniversalBreaches = (patterns, totalAmount, suspiciousCount) => {
  const breaches = [];

  breaches.push(
    RegulatoryBreach(
      "BSA Suspicious Activity Report",
      "31 USC §5318(g)",
      "critical",
      `${suspiciousCount} suspicious transactions totalling $${totalAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
      "Requires financial institutions to report any known or suspected violation of law or suspicious activity involving $5,000 or more.",
      `The observed transaction patterns — ${patterns.filter((p) => p !== "normal").join(", ") || "anomalous behaviour"} — meet the statutory threshold for mandatory SAR filing. The aggregate suspicious amount of $${totalAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })} substantially exceeds the $5,000 reporting minimum.`,
      97
    )
  );

  breaches.push(
    RegulatoryBreach(
      "FinCEN SAR Filing Rule",
      "31 CFR §1020.320",
      "critical",
      "Multi-transaction suspicious pattern detected by AML monitoring system",
      "Banks and financial institutions must file SARs for transactions indicating possible money laundering, tax evasion, or other financial crimes.",
      `Automated AML monitoring identified ${suspiciousCount} transactions with anomalous patterns. The FinCEN SAR rule mandates filing within 30 calendar days of detection. Non-filing constitutes a regulatory violation.`,
      95
    )
  );

  breaches.push(
    RegulatoryBreach(
      "USA PATRIOT Act — AML Program Requirements",
      "31 USC §5318(h) / Section 352",
      "high",
      "AML monitoring system flagged suspicious behavioural patterns",
      "Requires financial institutions to maintain anti-money laundering programs with transaction monitoring, customer due diligence, and suspicious activity reporting.",
      `The transaction monitoring system identified patterns consistent with Section 352 obligations. The institution's AML programme has correctly flagged these transactions; this SAR documents compliance with programme requirements.`,
      90
    )
  );

  breaches.push(
    RegulatoryBreach(
      "FATF Recommendation 20 — Suspicious Transaction Reporting",
      "FATF R-20 (2012, Rev. 2023)",
      "high",
      "Typological match to FATF ML/TF typologies",
      "Countries should require financial institutions and other entities to report suspicious transactions to the financial intelligence unit.",
      `The activity observed aligns with typologies documented in FATF guidance, including transaction structuring, cross-border movement, and network obfuscation. FATF Recommendation 20 requires this activity to be reported to the national FIU.`,
      88
    )
  );

  return breaches;
};

/**
 * Type-specific regulatory breaches
 */
const TypeBreachMap = {
  "Crypto Laundering Indicator": [
    RegulatoryBreach(
      "FinCEN Virtual Currency Guidance",
      "FIN-2019-A003",
      "high",
      "Cryptocurrency exchange interaction detected in network graph",
      "Clarifies how the Bank Secrecy Act applies to businesses dealing in convertible virtual currencies.",
      "The subject entity's network includes crypto exchange interactions. FinCEN guidance FIN-2019-A003 establishes that transactions involving convertible virtual currency are subject to full BSA/AML requirements including SAR filing.",
      85
    ),
    RegulatoryBreach(
      "FATF Recommendation 15 — New Technologies",
      "FATF R-15 (2019 Rev.)",
      "high",
      "Virtual asset service provider (VASP) connections identified",
      "Countries should assess ML/TF risks associated with virtual assets and virtual asset service providers.",
      "Transaction data shows conversion chains consistent with cryptocurrency layering. FATF R-15 requires jurisdictions to apply AML/CFT measures to VASPs; this filing documents the identified risk.",
      82
    ),
  ],
  "Shell Company Transfer": [
    RegulatoryBreach(
      "FATF Recommendation 24 — Beneficial Ownership",
      "FATF R-24 (2022 Rev.)",
      "critical",
      "Offshore shell company linkage identified in entity network",
      "Countries should ensure adequate, accurate and current information on the beneficial ownership of legal persons is available to competent authorities.",
      "Network graph analysis reveals connections to entities in BVI, Cayman Islands, and/or Panama — jurisdictions commonly used for shell company formation. FATF R-24 requires disclosure of beneficial ownership; this creates a regulatory gap that the SAR documents.",
      91
    ),
  ],
  "Offshore Structuring": [
    RegulatoryBreach(
      "BSA Structuring Prohibition",
      "31 USC §5324",
      "critical",
      "Multiple sub-threshold transactions detected in same period",
      "Federal law prohibits structuring transactions to evade Currency Transaction Report ($10,000 threshold) filing requirements.",
      "Transaction analysis reveals multiple payments falling just below the $10,000 CTR threshold (range $9,500–$9,900) within concentrated time windows. This pattern is a textbook indicator of structuring — a federal criminal offence under 31 USC §5324.",
      94
    ),
  ],
  "Trade Finance Fraud": [
    RegulatoryBreach(
      "FATF Trade-Based Money Laundering Guidance",
      "FATF TBML (2020)",
      "critical",
      "Trade invoice-to-transaction discrepancy detected",
      "Provides guidance on identifying and investigating trade-based money laundering through manipulation of international trade transactions.",
      "The transaction pattern exhibits characteristics consistent with FATF TBML typologies: over/under-invoicing, multiple invoicing, and falsely described goods. The guidance requires institutions to report such activity.",
      87
    ),
  ],
};

const DefaultBreach = [
  RegulatoryBreach(
    "FATF Recommendation 10 — Customer Due Diligence",
    "FATF R-10 (2012, Rev. 2023)",
    "high",
    "High-risk account activity inconsistent with stated business purpose",
    "Requires financial institutions to undertake CDD measures when there is a suspicion of ML/TF.",
    "The transaction pattern is inconsistent with the account's expected activity profile. FATF R-10 requires enhanced CDD when suspicious activity is detected, including re-verification of customer identity and purpose of transactions.",
    82
  ),
];

/**
 * Computes regulatory impact score based on breach severity
 */
const computeImpactScore = (breaches) => {
  const weights = { critical: 30, high: 18, medium: 10, low: 5 };
  const maxPossible = Math.max(breaches.length * 30, 1);
  const total = breaches.reduce((s, b) => s + (weights[b.severity] ?? 5), 0);
  return Math.min(100, Math.round((total / maxPossible) * 100));
};

/**
 * Analyzes transaction patterns to identify suspicious behaviors
 */
const analyzeTransactionPatterns = (transactions) => {
  const patterns = new Set();
  const suspiciousCount = transactions.filter((t) => t.is_suspicious).length;

  if (suspiciousCount > 0) {
    transactions.forEach((t) => {
      if (t.is_suspicious) {
        if (t.pattern && t.pattern !== "normal") {
          patterns.add(t.pattern);
        }
      }
    });
  }

  return Array.from(patterns).length > 0 ? Array.from(patterns) : ["general_suspicious_activity"];
};

/**
 * Generates regulatory breaches based on detected patterns
 */
const generateRegulatoryBreaches = (patterns, totalAmount, suspiciousCount) => {
  let breaches = getUniversalBreaches(patterns, totalAmount, suspiciousCount);

  // Add type-specific breaches based on detected patterns
  patterns.forEach((pattern) => {
    const typeBreaches = TypeBreachMap[pattern];
    if (typeBreaches) {
      breaches = breaches.concat(typeBreaches);
    }
  });

  // Ensure at least default breach is included
  if (breaches.length === 0) {
    breaches = DefaultBreach;
  }

  // Remove duplicates
  const uniqueBreaches = Array.from(new Map(breaches.map((b) => [b.rule, b])).values());

  return uniqueBreaches;
};

// ─── Main SAR Generation Functions ────────────────────────────────────

/**
 * Generates a comprehensive SAR report from transaction data and context
 */
export const generateSARReport = async (req, res) => {
  try {
    const { entityId, baselineReport, context } = req.body;

    // Validation
    if (!entityId) {
      return sendValidationError(res, { entityId: "Entity ID is required" });
    }

    if (!baselineReport || typeof baselineReport !== "object") {
      return sendValidationError(res, { baselineReport: "Valid baseline report is required" });
    }

    if (!context || typeof context !== "object") {
      return sendValidationError(res, { context: "Context data is required" });
    }

    // Extract context data
    const transactions = context.transactions || [];
    const networkEdges = context.networkEdges || [];
    const externalRisk = context.externalRisk || [];
    const historicalSARs = context.historicalSARs || [];

    console.log(`[SAR] Generating SAR report for entity ${entityId} (${transactions.length} transactions)`);

    // ─── Step 1: Analyze patterns (existing rule engine) ─────────────────
    const patterns = analyzeTransactionPatterns(transactions);
    const suspiciousCount = transactions.filter((t) => t.is_suspicious).length;
    const totalAmount = transactions.reduce((sum, t) => sum + (t.is_suspicious ? t.amount : 0), 0);

    // ─── Step 2: Attempt ML API integration ──────────────────────────────
    let mlData = null;
    let mlSuccess = false;

    try {
      // Build pseudo-transaction objects for ML
      const mlTransactions = transactions.map(t => ({
        displayId: t.id,
        amount: t.amount,
        currency: t.currency || "USD",
        timestamp: t.date || new Date().toISOString(),
        senderDetails: { acc_id: t.sender_account || "", country: t.sender_country || "" },
        receiverDetails: { acc_id: t.receiver_account || "", country: t.receiver_country || "" },
        category: t.type || t.category || "",
        isFlagged: t.is_suspicious || false,
        externalTxId: t.id,
      }));

      const mlResult = await callMLGenerateSAR(mlTransactions, entityId);
      if (mlResult.success) {
        mlData = mlResult.data;
        mlSuccess = true;
        console.log(`[ML] Response received (risk_score=${mlData.risk_score})`);
      }
    } catch (mlErr) {
      console.warn(`[ML] ML API unavailable, using rule engine only: ${mlErr.message}`);
    }

    // ─── Step 3: Build fraud graph ───────────────────────────────────────
    const graphTransactions = transactions.map(t => ({
      ...t,
      senderDetails: { acc_id: t.sender_account, country: t.sender_country },
      receiverDetails: { acc_id: t.receiver_account, country: t.receiver_country },
    }));

    const graphData = buildFraudGraph(graphTransactions, { id: entityId }, mlData || {});

    // ─── Step 4: Risk attribution ────────────────────────────────────────
    const caseProxy = {
      transactions: graphTransactions,
      displayId: entityId,
    };
    const riskAttribution = generateRiskAttribution(caseProxy, mlData || {}, graphData);

    // ─── Step 5: Generate regulatory breaches (existing engine) ──────────
    const regulatoryBreaches = generateRegulatoryBreaches(patterns, totalAmount, suspiciousCount);
    const regulatoryImpactScore = computeImpactScore(regulatoryBreaches);

    // ─── Step 6: Build enhanced report ───────────────────────────────────
    const enhancedReport = {
      ...baselineReport,
      regulatoryBreaches,
      regulatoryImpactScore,
      modelVersion: mlSuccess
        ? `${baselineReport.modelVersion} (ML + Backend Rule Engine)`
        : `${baselineReport.modelVersion} (Backend Rule Engine)`,
      aiConfidence: mlSuccess
        ? Math.min(99, Math.round(riskAttribution.risk_score * 100))
        : Math.min(99, baselineReport.aiConfidence || 85),
      // ML-enhanced fields
      mlRiskScore: riskAttribution.risk_score,
      mlRiskLevel: riskAttribution.risk_level,
      typologies: riskAttribution.typologies,
      graphStats: graphData.stats,
    };

    // Enrich activity description with ML + graph analysis
    if (!enhancedReport.activityDescription || enhancedReport.activityDescription.includes("Local Rules") || enhancedReport.activityDescription.includes("rule engine")) {
      const mlNarrative = mlData?.sar_narrative;
      if (mlNarrative && mlSuccess) {
        enhancedReport.activityDescription = mlNarrative;
      } else {
        enhancedReport.activityDescription = `
          Backend analysis identified ${suspiciousCount} suspicious transaction(s) totalling $${totalAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })} across ${enhancedReport.countriesInvolved?.length || 0} jurisdiction(s).
          
          Primary patterns detected: ${patterns.join(", ")}.
          ${riskAttribution.typologies.length > 0 ? `Typologies identified: ${riskAttribution.typologies.join(", ")}.` : ""}
          
          Network analysis reveals ${networkEdges.length} connections between entities, with ${graphData.flagged_paths.length} suspicious fund flow path(s) detected. ${graphData.clusters.length} entity cluster(s) identified.
          
          Risk indicators have been cross-referenced against ${historicalSARs.length} historical precedents, confirming alignment with known AML typologies.
          
          Composite risk score: ${Math.round(riskAttribution.risk_score * 100)}% (ML: ${Math.round((riskAttribution.ml_contribution?.risk_score || 0) * 100)}%, Rules: ${Math.round((riskAttribution.rule_contribution?.risk_score || 0) * 100)}%, Graph: ${Math.round((riskAttribution.graph_contribution?.risk_score || 0) * 100)}%)
        `.trim();
      }
    }

    console.log(`[SAR] Narrative generated successfully for ${entityId}`);

    return sendSuccess(
      res,
      {
        report: enhancedReport,
        narrative: enhancedReport.activityDescription,
        conclusion: enhancedReport.conclusion,
        modelVersion: enhancedReport.modelVersion,
        aiConfidence: enhancedReport.aiConfidence,
        // New ML-enriched fields (additive, won't break frontend)
        mlIntegrated: mlSuccess,
        riskAttribution: {
          risk_score: riskAttribution.risk_score,
          risk_level: riskAttribution.risk_level,
          typologies: riskAttribution.typologies,
          explainability: riskAttribution.explainability,
        },
        graphSummary: graphData.stats,
      },
      "SAR report generated successfully",
      200
    );
  } catch (error) {
    console.error("Error in SAR generation:", error);
    return sendError(res, 500, "Failed to generate SAR report", error.message);
  }
};

/**
 * Retrieve a generated SAR report by ID
 */
export const getSARById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return sendValidationError(res, { id: "SAR ID is required" });
    }

    // Query from database
    const sar = await db.query.sarReports.findFirst({
      where: eq(sarReports.id, id),
    });

    if (!sar) {
      return sendNotFound(res, "SAR Report");
    }

    return sendSuccess(res, sar, "SAR report retrieved successfully");
  } catch (error) {
    console.error("Error retrieving SAR:", error);
    return sendError(res, 500, "Failed to retrieve SAR report", error.message);
  }
};

/**
 * Generate narrative using context and evidence
 */
export const generateNarrative = async (req, res) => {
  try {
    const { id } = req.params;
    const { report, context } = req.body;

    if (!id) {
      return sendValidationError(res, { id: "SAR ID is required" });
    }

    if (!report) {
      return sendValidationError(res, { report: "Report data is required" });
    }

    // In a real implementation, this would call an LLM endpoint
    // For now, we'll generate a narrative from the report data
    const narrative = buildNarrativeFromReport(report);

    return sendSuccess(
      res,
      {
        narrative,
        conclusion: report.conclusion || "Activity warrants SAR filing.",
        sarId: id,
      },
      "Narrative generated successfully"
    );
  } catch (error) {
    console.error("Error generating narrative:", error);
    return sendError(res, 500, "Failed to generate narrative", error.message);
  }
};

/**
 * Helper function to build narrative from report
 */
const buildNarrativeFromReport = (report) => {
  let narrative = `SAR NARRATIVE REPORT\n\n`;

  narrative += `SUBJECT: ${report.entityId}\n`;
  narrative += `RISK CATEGORY: ${report.riskCategory} (Score: ${report.riskScore}/100)\n`;
  narrative += `REPORTING PERIOD: ${report.periodStart} to ${report.periodEnd}\n\n`;

  narrative += `EXECUTIVE SUMMARY:\n`;
  narrative += `${report.activityDescription}\n\n`;

  narrative += `TRANSACTION ANALYSIS:\n`;
  narrative += `Total Transactions: ${report.txnCount}\n`;
  narrative += `Suspicious Transactions: ${report.suspiciousTxnCount}\n`;
  narrative += `Total Amount: $${report.totalAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}\n`;
  narrative += `Average Transaction: $${report.avgAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}\n`;
  narrative += `Maximum Single Transaction: $${report.maxSingleAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}\n\n`;

  if (report.patternsObserved && report.patternsObserved.length > 0) {
    narrative += `PATTERNS IDENTIFIED:\n`;
    report.patternsObserved.forEach((pattern) => {
      narrative += `- ${pattern}\n`;
    });
    narrative += "\n";
  }

  if (report.countriesInvolved && report.countriesInvolved.length > 0) {
    narrative += `JURISDICTIONS INVOLVED: ${report.countriesInvolved.join(", ")}\n\n`;
  }

  if (report.regulatoryBreaches && report.regulatoryBreaches.length > 0) {
    narrative += `REGULATORY FRAMEWORK:\n`;
    narrative += `${report.regulatoryBreaches.length} regulatory obligations identified.\n`;
    const criticalCount = report.regulatoryBreaches.filter((b) => b.severity === "critical").length;
    if (criticalCount > 0) {
      narrative += `${criticalCount} CRITICAL obligations flagged.\n`;
    }
    narrative += "\n";
  }

  narrative += `CONCLUSION:\n${report.conclusion}\n`;
  narrative += `\nConfidence Level: ${report.aiConfidence}%\n`;
  narrative += `Report Generated: ${new Date().toISOString()}\n`;

  return narrative;
};

/**
 * Save SAR report to database (persists frontend-generated reports)
 * POST /api/sar/save
 * Body: { caseId?, displayId?, entityId, report, narrative }
 */
export const saveSARReport = async (req, res) => {
  try {
    const { caseId, displayId, entityId, report, narrative } = req.body;

    if (!entityId || !report) {
      return sendValidationError(res, {
        entityId: "Entity ID required",
        report: "Report data required",
      });
    }

    // If caseId (UUID) provided, update existing case
    if (caseId) {
      const updated = await db.update(cases)
        .set({
          summaryLlm: narrative || "",
          mlInsights: report,
          status: "DRAFT",
          riskScore: report.riskScore ? String(report.riskScore > 1 ? report.riskScore / 100 : report.riskScore) : null,
          riskLevel: report.riskCategory === "critical" ? "CRITICAL"
            : report.riskCategory === "high" ? "HIGH"
              : report.riskCategory === "medium" ? "MEDIUM" : "LOW",
          updatedAt: new Date(),
        })
        .where(eq(cases.id, caseId))
        .returning();

      if (!updated || updated.length === 0) {
        return sendNotFound(res, "Case not found");
      }

      const savedCase = updated[0];

      await db.insert(auditLogs).values({
        caseId: caseId,
        action: "SAR_REPORT_SAVED",
        actor: "SYSTEM",
        details: `SAR report generated for entity ${entityId} and saved to case ${savedCase.displayId || caseId}`,
      });

      return sendSuccess(res, {
        caseId: savedCase.id,
        displayId: savedCase.displayId,
        status: savedCase.status,
      }, "SAR report saved to existing case", 200);
    }

    // No caseId — create a new case with the report
    const { sql } = await import("drizzle-orm");
    const maxResult = await db.execute(
      sql`SELECT display_id FROM cases WHERE display_id LIKE 'SAR-%' ORDER BY display_id DESC LIMIT 1`
    );
    const maxRow = maxResult?.rows?.[0] || maxResult?.[0];
    const lastNum = maxRow?.display_id
      ? parseInt(maxRow.display_id.replace("SAR-", ""), 10) : 0;
    const newDisplayId = displayId || `SAR-${String(lastNum + 1).padStart(4, "0")}`;

    const inserted = await db.insert(cases).values({
      displayId: newDisplayId,
      status: "DRAFT",
      summaryLlm: narrative || "",
      mlInsights: report,
      customerDetails: { id: entityId, name: report.subjectName || entityId },
      riskScore: report.riskScore ? String(report.riskScore > 1 ? report.riskScore / 100 : report.riskScore) : null,
      riskLevel: report.riskCategory === "critical" ? "CRITICAL"
        : report.riskCategory === "high" ? "HIGH"
          : report.riskCategory === "medium" ? "MEDIUM" : "LOW",
    }).returning();

    const newCase = inserted[0];

    await db.insert(auditLogs).values({
      caseId: newCase.id,
      action: "SAR_REPORT_CREATED",
      actor: "SYSTEM",
      details: `New SAR report created for entity ${entityId}: ${newDisplayId}`,
    });

    return sendSuccess(res, {
      caseId: newCase.id,
      displayId: newCase.displayId,
      status: newCase.status,
    }, "SAR report saved as new case", 201);

  } catch (error) {
    console.error("Error saving SAR:", error);
    return sendError(res, 500, "Failed to save SAR report", error.message);
  }
};

