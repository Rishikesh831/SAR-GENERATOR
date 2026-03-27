// Synthetic data for SAR Narrative Generator

import type { FullSARReport } from "@/lib/csvLoader";

export type RiskLevel = "high" | "medium" | "low";
export type SARStatus = "draft" | "review" | "approved" | "filed";
export type TransactionStatus = "flagged" | "cleared" | "pending" | "under_review";
export type FlagType = "structuring" | "round_amounts" | "cross_border" | "crypto" | "high_value" | "smurfing" | "trade_based";

export interface Customer {
  id: string;
  name: string;
  accounts: string[];
  riskRating: RiskLevel;
  kycStatus: "verified" | "pending" | "expired";
  businessType: string;
  country: string;
  flagCount: number;
}

export interface Transaction {
  id: string;
  _dbId?: string;
  customerId: string;
  customerName: string;
  amount: number;
  currency: string;
  date: string;
  riskScore: number;
  status: TransactionStatus;
  flagType: FlagType | null;
  senderAccount: string;
  receiverAccount: string;
  country: string;
  type: string;
}

export interface SARReport {
  id: string;
  _dbId?: string;
  transactionIds: string[];
  caseId?: string;
  sourceTransactionId?: string;
  customerId: string;
  customerName: string;
  status: SARStatus;
  createdAt: string;
  updatedAt: string;
  generatedAt?: string;
  assignedTo: string;
  confidenceScore: number;
  modelUsed: string;
  promptVersion: string;
  lifecycleVersion?: number;
  narrative?: string;
  daysRemaining: number;
  priority: RiskLevel;
  deadline?: string;
  entityType?: string;
  ein?: string;
  address?: string;
  industryType?: string;
  riskBreakdown?: { label: string; value: number }[];
  triggerRules?: { id: string; name: string; confidence: number }[];
  evidenceAnchors?: string[];
  timelineEvents?: { date: string; event: string }[];
  draftReportSnapshot?: FullSARReport;
  finalReportSnapshot?: FullSARReport;
  changeHistory?: {
    timestamp: string;
    stage: "investigation" | "review" | "approval" | "filing";
    actor: string;
    layer?: number;
    summary: string;
    changes: { field: string; previous: string; current: string }[];
  }[];
  filingStamp?: {
    caseId: string;
    filedAt: string;
    filedBy: string;
    statusLabel: "Filed SAR Report";
  };
}

export interface AuditEntry {
  id: string;
  sarId: string;
  timestamp: string;
  user: string;
  role: string;
  action: string;
  modelVersion?: string;
  promptVersionId?: string;
  details: string;
}

export interface AlertItem {
  id: string;
  message: string;
  time: string;
  severity: RiskLevel;
  transactionId: string;
}

const firstNames = ["James", "Sarah", "Michael", "Elena", "Robert", "Aisha", "William", "Chen", "David", "Fatima", "Thomas", "Maria", "Richard", "Yuki", "Carlos", "Anastasia", "Ahmed", "Patricia", "Ivan", "Priya"];
const lastNames = ["Morgan", "Petrov", "Chen", "Al-Rashid", "Schmidt", "Tanaka", "Okafor", "Santos", "Kim", "Mueller", "Patel", "Johansson", "Nakamura", "Volkov", "Garcia", "Ibrahim", "Larsson", "Yamamoto", "Costa", "Andersen"];
const businessTypes = ["Import/Export", "Real Estate", "Cryptocurrency Exchange", "Shell Company", "Retail", "Consulting", "Construction", "Jewelry", "Art Dealer", "Financial Services", "Tech Startup", "Shipping"];
const countries = ["US", "UK", "DE", "CH", "SG", "HK", "AE", "BVI", "CY", "LU", "MT", "PA", "BS", "KY", "RU", "CN", "BR", "IN", "NG", "ZA"];
const currencies = ["USD", "EUR", "GBP", "CHF", "BTC", "ETH", "SGD", "AED", "CNY", "JPY"];
const txTypes = ["Wire Transfer", "ACH", "Cash Deposit", "Crypto Transfer", "Trade Finance", "Letter of Credit", "Foreign Exchange", "Internal Transfer"];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateAccountNumber(): string {
  return `${randomBetween(1000, 9999)}-${randomBetween(1000, 9999)}-${randomBetween(100000, 999999)}`;
}

function generateDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

// Empty Data (only backend will be used)
export const customers: Customer[] = [];

// Generate transactions
export const transactions: Transaction[] = [];

export const flaggedTransactions: Transaction[] = [];

export const sarReports: SARReport[] = [];

export const auditEntries: AuditEntry[] = [];

export const recentAlerts: AlertItem[] = [];

// Dashboard metrics
export const dashboardMetrics = {
  totalSARsFiled: { thisMonth: 0, thisYear: 0, trend: 0 },
  pendingReviews: { count: 0, urgent: 0 },
  falsePositiveRate: { percentage: 0, trend: 0 },
  avgProcessingTime: { hours: 0, trend: 0 },
  casesPerHour: 0,
  sarGenerationTime: "N/A",
  timeReduction: 0,
  falsePositiveReduction: 0,
};

// SHAP feature attribution data for narrative lines
export interface SHAPFeature {
  name: string;
  value: number;
  baseValue?: string;
}

export const shapFeatureMap: Record<string, SHAPFeature[]> = {
  "amount": [
    { name: "Transaction Amount", value: 0.342, baseValue: "$495,000" },
    { name: "Round Amount Pattern", value: 0.156, baseValue: "Yes" },
    { name: "Velocity (24h)", value: 0.089, baseValue: "4.2hrs avg" },
    { name: "Historical Baseline", value: -0.034, baseValue: "+312%" },
  ],
  "wire": [
    { name: "Transaction Type", value: 0.287, baseValue: "Wire Transfer" },
    { name: "Cross-Border Flag", value: 0.245, baseValue: "Yes" },
    { name: "Amount Threshold", value: 0.198, baseValue: "$495K" },
    { name: "Beneficiary Type", value: 0.134, baseValue: "Offshore Entity" },
  ],
  "structuring": [
    { name: "Structuring Pattern", value: 0.456, baseValue: "12 instances" },
    { name: "CTR Threshold Evasion", value: 0.389, baseValue: "$9,500-$9,900" },
    { name: "Geographic Dispersion", value: 0.167, baseValue: "Multiple branches" },
    { name: "Time Window", value: 0.123, baseValue: "24hrs" },
  ],
  "jurisdiction": [
    { name: "Jurisdiction Risk", value: 0.398, baseValue: "BVI/Cyprus/Panama" },
    { name: "FATF Grey List", value: 0.312, baseValue: "3 of 4" },
    { name: "Shell Entity Flag", value: 0.267, baseValue: "Yes" },
    { name: "Tax Haven Indicator", value: 0.189, baseValue: "High" },
  ],
  "cash": [
    { name: "Cash Deposit Pattern", value: 0.423, baseValue: "$9,800" },
    { name: "CTR Avoidance", value: 0.378, baseValue: "Below $10K" },
    { name: "Branch Hopping", value: 0.234, baseValue: "Branch #442, #118" },
    { name: "Frequency", value: 0.156, baseValue: "Same day" },
  ],
  "layering": [
    { name: "Layering Complexity", value: 0.412, baseValue: "4 intermediaries" },
    { name: "Circular Transfer", value: 0.367, baseValue: "Round-trip" },
    { name: "Holding Time", value: 0.289, baseValue: "4.2hrs avg" },
    { name: "Entity Network", value: 0.198, baseValue: "Shell companies" },
  ],
  "trade": [
    { name: "Trade-Based ML", value: 0.487, baseValue: "FATF Match 94%" },
    { name: "Over-Invoicing", value: 0.445, baseValue: "+340%" },
    { name: "Invoice Mismatch", value: 0.334, baseValue: "Market value" },
    { name: "Commodity Type", value: 0.178, baseValue: "Industrial machinery" },
  ],
  "default": [
    { name: "Overall Risk Score", value: 0.298, baseValue: "92/100" },
    { name: "Behavioral Deviation", value: 0.234, baseValue: "+312%" },
    { name: "Peer Group Anomaly", value: 0.189, baseValue: "4.7σ" },
    { name: "Historical Pattern", value: 0.145, baseValue: "12-month baseline" },
  ],
};

export function getSHAPFeaturesForText(text: string): SHAPFeature[] {
  const lowerText = text.toLowerCase();
  if (lowerText.includes("structuring") || lowerText.includes("smurfing")) return shapFeatureMap["structuring"];
  if (lowerText.includes("trade") || lowerText.includes("invoice") || lowerText.includes("over-invoicing")) return shapFeatureMap["trade"];
  if (lowerText.includes("layering") || lowerText.includes("shell") || lowerText.includes("circular")) return shapFeatureMap["layering"];
  if (lowerText.includes("cash deposit")) return shapFeatureMap["cash"];
  if (lowerText.includes("jurisdiction") || lowerText.includes("bvi") || lowerText.includes("cyprus") || lowerText.includes("panama") || lowerText.includes("cayman")) return shapFeatureMap["jurisdiction"];
  if (lowerText.includes("wire transfer") || lowerText.includes("wire")) return shapFeatureMap["wire"];
  if (lowerText.includes("$") || lowerText.includes("amount") || lowerText.includes("million")) return shapFeatureMap["amount"];
  return shapFeatureMap["default"];
}
