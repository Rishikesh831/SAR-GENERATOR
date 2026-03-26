/**
 * Reference Data Controller
 * Provides regulatory rules, typologies, and other reference data to frontend
 */

import { sendSuccess, sendError } from "../middlewares/apiResponse.js";

/**
 * High-risk countries list (FATF Grey List, OFAC, etc.)
 */
const HIGH_RISK_COUNTRIES = [
  { code: "BVI", name: "British Virgin Islands", risk: "high", source: "FATF" },
  { code: "CY", name: "Cyprus", risk: "medium", source: "FATF" },
  { code: "PA", name: "Panama", risk: "high", source: "FATF" },
  { code: "BS", name: "Bahamas", risk: "high", source: "OFAC" },
  { code: "KY", name: "Cayman Islands", risk: "medium", source: "FATF" },
  { code: "RU", name: "Russia", risk: "high", source: "OFAC" },
  { code: "LU", name: "Luxembourg", risk: "low", source: "FATF" },
  { code: "MT", name: "Malta", risk: "medium", source: "FATF" },
  { code: "AE", name: "United Arab Emirates", risk: "medium", source: "FATF" },
  { code: "HK", name: "Hong Kong", risk: "medium", source: "FATF" },
  { code: "SG", name: "Singapore", risk: "low", source: "FATF" },
  { code: "CH", name: "Switzerland", risk: "low", source: "FATF" },
];

/**
 * AML/CFT Regulatory Framework Rules
 */
const REGULATORY_RULES = [
  {
    id: "BSA-5318",
    title: "BSA Suspicious Activity Report",
    reference: "31 USC §5318(g)",
    severity: "critical",
    jurisdiction: "USA",
    description:
      "Requires financial institutions to report any known or suspected violation of law or suspicious activity involving $5,000 or more.",
    applicablePatterns: ["all"],
    threshold: 5000,
    filingDeadline: 30,
  },
  {
    id: "FINCEN-1020",
    title: "FinCEN SAR Filing Rule",
    reference: "31 CFR §1020.320",
    severity: "critical",
    jurisdiction: "USA",
    description:
      "Banks and financial institutions must file SARs for transactions indicating possible money laundering, tax evasion, or other financial crimes.",
    applicablePatterns: ["structuring", "trade_fraud", "crypto_laundering"],
    threshold: 5000,
    filingDeadline: 30,
  },
  {
    id: "PATRIOT-352",
    title: "USA PATRIOT Act — AML Program Requirements",
    reference: "31 USC §5318(h) / Section 352",
    severity: "high",
    jurisdiction: "USA",
    description:
      "Requires financial institutions to maintain anti-money laundering programs with transaction monitoring, customer due diligence, and suspicious activity reporting.",
    applicablePatterns: ["all"],
    threshold: 0,
    filingDeadline: 0,
  },
  {
    id: "FATF-R20",
    title: "FATF Recommendation 20 — Suspicious Transaction Reporting",
    reference: "FATF R-20 (2012, Rev. 2023)",
    severity: "high",
    jurisdiction: "Global",
    description:
      "Countries should require financial institutions and other entities to report suspicious transactions to the financial intelligence unit.",
    applicablePatterns: ["all"],
    threshold: 5000,
    filingDeadline: 30,
  },
  {
    id: "FATF-R24",
    title: "FATF Recommendation 24 — Beneficial Ownership",
    reference: "FATF R-24 (2022 Rev.)",
    severity: "critical",
    jurisdiction: "Global",
    description:
      "Countries should ensure adequate, accurate and current information on the beneficial ownership of legal persons is available to competent authorities.",
    applicablePatterns: ["shell_company", "offshore_structuring"],
    threshold: 0,
    filingDeadline: 0,
  },
  {
    id: "EU-AMLD5",
    title: "EU 5th AML Directive — Enhanced CDD",
    reference: "Directive 2018/843 Art. 13",
    severity: "high",
    jurisdiction: "EU",
    description:
      "Requires member states to apply enhanced due diligence measures to high-risk third countries and customers.",
    applicablePatterns: ["high_risk_jurisdiction"],
    threshold: 0,
    filingDeadline: 0,
  },
  {
    id: "MICA-REG",
    title: "EU Markets in Crypto-Assets (MiCA)",
    reference: "Regulation (EU) 2023/1114",
    severity: "medium",
    jurisdiction: "EU",
    description:
      "Establishes AML obligations for crypto-asset service providers operating within the European Union.",
    applicablePatterns: ["crypto_laundering"],
    threshold: 0,
    filingDeadline: 0,
  },
];

/**
 * AML/CFT Typologies (Money Laundering & Terrorism Financing Patterns)
 */
const TYPOLOGIES = [
  {
    id: "structuring",
    name: "Structuring / Smurfing",
    description:
      "Dividing transactions into smaller amounts to avoid reporting thresholds (typically $10,000 CTR threshold).",
    riskLevel: "high",
    patterns: ["multiple_micro_deposits", "sub_threshold_transactions", "rapid_deposits"],
    indicativeAmount: "multiple deposits $9,500-$9,900 within short timespan",
    example: "Customer deposits $9,500 daily for 10 days to avoid $10,000 CTR reporting.",
  },
  {
    id: "layering",
    name: "Layering / High-Value Transfers",
    description:
      "Complex movement of funds through multiple accounts, institutions, or countries to obscure origin.",
    riskLevel: "high",
    patterns: [
      "rapid_re_movement",
      "multiple_intermediaries",
      "cross_border_movement",
    ],
    indicativeAmount: "$25,000+ transferred through 3+ jurisdictions",
    example: "Funds received from Hong Kong transferred to Cayman Islands, then to Panama shell company.",
  },
  {
    id: "integration",
    name: "Integration / Cash-Intensive Business",
    description: "Reintroducing laundered funds into financial system via cash-intensive businesses.",
    riskLevel: "medium",
    patterns: ["cash_deposits", "round_amounts", "business_accounts"],
    indicativeAmount: "Large cash deposits to merchant account",
    example: "Casino receives $50,000 daily deposits, no corresponding gaming records.",
  },
  {
    id: "crypto_laundering",
    name: "Cryptocurrency Conversion Chain",
    description:
      "Using cryptocurrency exchanges to convert fiat to crypto/stablecoins to obscure trails.",
    riskLevel: "critical",
    patterns: [
      "crypto_to_fiat",
      "fiat_to_crypto",
      "stablecoin_swaps",
      "cross_exchange",
    ],
    indicativeAmount: "$10,000+ in crypto conversions within 24 hours",
    example: "Wire received from BVI → Convert to Bitcoin → Convert to Monero → Cash out in different city.",
  },
  {
    id: "shell_company",
    name: "Shell Company Transfer",
    description: "Using offshore shell companies to obscure beneficial ownership and fund flows.",
    riskLevel: "critical",
    patterns: ["offshore_entities", "no_actual_business", "front_company"],
    indicativeAmount: "$50,000+ to offshore entities with no clear business purpose",
    example: "Funds transferred to BVI company with no actual operations, directors are nominees.",
  },
  {
    id: "trade_fraud",
    name: "Trade Finance / Invoice Manipulation",
    description:
      "Manipulating international trade invoices to move value across borders (over/under-invoicing).",
    riskLevel: "high",
    patterns: ["invoice_mismatch", "over_invoicing", "false_shipments"],
    indicativeAmount: "Invoice discrepancy >30% from market value",
    example: "Export of widgets to Dubai invoiced at $50/unit vs. market $10/unit.",
  },
  {
    id: "round_amounts",
    name: "Round Amount Pattern",
    description: "Suspicious pattern of identical or round-dollar amounts to same beneficiaries.",
    riskLevel: "medium",
    patterns: ["identical_amounts", "round_numbers", "systematic_transfers"],
    indicativeAmount: "6+ identical transactions of exact same amount ($10,000 each)",
    example: "Customer sends exactly $15,000 to 5 different beneficiaries over consecutive days.",
  },
  {
    id: "rapid_movement",
    name: "Rapid Cross-Border Movement",
    description: "Extremely fast movement of funds across multiple international jurisdictions.",
    riskLevel: "high",
    patterns: ["multi_country", "same_day_transfer", "high_velocity"],
    indicativeAmount: "$50,000+ moved across 3+ countries within 24 hours",
    example:
      "Wire received from Singapore, moved to Hong Kong account within 2 hours, then to BVI account same day.",
  },
  {
    id: "new_account_rapid_funding",
    name: "New Account Rapid Funding",
    description: "Newly opened account receiving large funding with no ramp-up period.",
    riskLevel: "high",
    patterns: ["new_account", "immediate_funding", "no_ramp_up"],
    indicativeAmount: "$500,000+ within 48 hours of account opening",
    example: "Account opened Monday, $1M wire received Tuesday, $1M withdrawn Wednesday.",
  },
];

/**
 * Get all regulatory rules
 */
export const getRegulatoryRules = async (req, res) => {
  try {
    const { jurisdiction, severity } = req.query;

    let rules = REGULATORY_RULES;

    if (jurisdiction) {
      rules = rules.filter(
        (r) => r.jurisdiction === jurisdiction || r.jurisdiction === "Global"
      );
    }

    if (severity) {
      rules = rules.filter((r) => r.severity === severity);
    }

    return sendSuccess(res, rules, `Retrieved ${rules.length} regulatory rules`);
  } catch (error) {
    console.error("Error fetching regulatory rules:", error);
    return sendError(res, 500, "Failed to fetch regulatory rules", error.message);
  }
};

/**
 * Get specific regulatory rule by ID
 */
export const getRegulatoryRuleById = async (req, res) => {
  try {
    const { id } = req.params;

    const rule = REGULATORY_RULES.find((r) => r.id === id);

    if (!rule) {
      return sendError(res, 404, `Regulatory rule '${id}' not found`);
    }

    return sendSuccess(res, rule, "Regulatory rule retrieved successfully");
  } catch (error) {
    console.error("Error fetching regulatory rule:", error);
    return sendError(res, 500, "Failed to fetch regulatory rule", error.message);
  }
};

/**
 * Get all AML/CFT typologies
 */
export const getTypologies = async (req, res) => {
  try {
    const { riskLevel } = req.query;

    let typologies = TYPOLOGIES;

    if (riskLevel) {
      typologies = typologies.filter((t) => t.riskLevel === riskLevel);
    }

    return sendSuccess(res, typologies, `Retrieved ${typologies.length} typologies`);
  } catch (error) {
    console.error("Error fetching typologies:", error);
    return sendError(res, 500, "Failed to fetch typologies", error.message);
  }
};

/**
 * Get specific typology by ID
 */
export const getTypologyById = async (req, res) => {
  try {
    const { id } = req.params;

    const typology = TYPOLOGIES.find((t) => t.id === id);

    if (!typology) {
      return sendError(res, 404, `Typology '${id}' not found`);
    }

    return sendSuccess(res, typology, "Typology retrieved successfully");
  } catch (error) {
    console.error("Error fetching typology:", error);
    return sendError(res, 500, "Failed to fetch typology", error.message);
  }
};

/**
 * Get high-risk countries list
 */
export const getHighRiskCountries = async (req, res) => {
  try {
    const { source, riskLevel } = req.query;

    let countries = HIGH_RISK_COUNTRIES;

    if (source) {
      countries = countries.filter((c) => c.source === source);
    }

    if (riskLevel) {
      countries = countries.filter((c) => c.risk === riskLevel);
    }

    return sendSuccess(res, countries, `Retrieved ${countries.length} high-risk countries`);
  } catch (error) {
    console.error("Error fetching high-risk countries:", error);
    return sendError(res, 500, "Failed to fetch high-risk countries", error.message);
  }
};

/**
 * Get comprehensive reference data (all at once)
 */
export const getReferenceData = async (req, res) => {
  try {
    const referenceData = {
      regulatoryRules: REGULATORY_RULES,
      typologies: TYPOLOGIES,
      highRiskCountries: HIGH_RISK_COUNTRIES,
      timestamp: new Date().toISOString(),
    };

    return sendSuccess(
      res,
      referenceData,
      "All reference data retrieved successfully"
    );
  } catch (error) {
    console.error("Error fetching reference data:", error);
    return sendError(res, 500, "Failed to fetch reference data", error.message);
  }
};
