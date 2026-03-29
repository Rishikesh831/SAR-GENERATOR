import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Code, Lock, Users, TrendingUp, Scale, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import LawComparisonDisplay from "@/components/sar/LawComparisonDisplay";
import LawAdaptationDisplay from "@/components/sar/LawAdaptationDisplay";

// Case Metadata (Header Section)
interface CaseMetadata {
  case_id: string;
  date_generated: string;
  reporting_unit: string;
  primary_country: string;
  ai_confidence: number;
  regulatory_impact: number;
  model_version: string;
}

// Subject Profile (Customer Risk Entity)
interface SubjectProfile {
  account_id: string;
  risk_score: number;
  risk_category: string;
  kyc_status: string;
  risk_types: string[];
  connections_count: number;
  relationship_types: string[];
  institution: string;
  countries_involved: string[];
}

// Transaction Summary (Aggregated Features)
interface TransactionSummary {
  review_period: {
    start: string;
    end: string;
  };
  total_amount: number;
  transaction_count: number;
  suspicious_transaction_count: number;
  average_amount: number;
  max_transaction: number;
  countries: string[];
  patterns_detected: string[];
}

// Suspicious Transaction Details (Row-Level Output)
interface SuspiciousTransaction {
  date: string;
  amount: number;
  type: string;
  from_account: string;
  to_account: string;
  indicator: string[];
}

// Regulatory Mapping (VERY IMPORTANT ⚠️)
interface RegulatoryMapping {
  severity: string;
  regulation: string;
  reference: string;
  confidence: number;
  trigger_reason: string;
}

// Risk Indicators (Explainability Layer)
type RiskIndicators = string[];

// Evidence Summary (Audit Layer)
interface EvidenceSummary {
  transaction_records: number;
  risk_score: number;
  network_connections: number;
  external_intelligence_hits: number;
  detection_type: string;
}

// Narrative Generation (LLM Output)
interface NarrativeGeneration {
  suspicious_activity_description: string;
  conclusion: string;
}

// Sample SAR Case Data
const sarCaseData = {
  metadata: {
    case_id: "SAR-2026-63084",
    date_generated: "2026-03-28",
    reporting_unit: "AML Compliance / FIU",
    primary_country: "KY",
    ai_confidence: 0.72,
    regulatory_impact: 0.76,
    model_version: "SAR Guardian v2.1",
  } as CaseMetadata,
  subject_profile: {
    account_id: "ACCT100192",
    risk_score: 70,
    risk_category: "HIGH",
    kyc_status: "UNDER_REVIEW",
    risk_types: [],
    connections_count: 2,
    relationship_types: ["high_value_flow", "shared_device"],
    institution: "Barclays Bank PLC",
    countries_involved: ["KY", "UK", "RU", "US", "AE", "CN", "IN"],
  } as SubjectProfile,
  transaction_summary: {
    review_period: {
      start: "2025-01-20",
      end: "2025-03-29",
    },
    total_amount: 476,
    transaction_count: 10,
    suspicious_transaction_count: 4,
    average_amount: 48,
    max_transaction: 144,
    countries: ["KY", "UK", "RU", "US", "AE", "CN", "IN"],
    patterns_detected: ["layering"],
  } as TransactionSummary,
  suspicious_transactions: [
    {
      date: "2025-01-27",
      amount: 23,
      type: "withdrawal",
      from_account: "ACCT100192",
      to_account: "ACCT200221",
      indicator: ["layering", "high_risk_country"],
    },
  ] as SuspiciousTransaction[],
  regulatory_mapping: [
    {
      severity: "CRITICAL",
      regulation: "BSA SAR Rule",
      reference: "31 USC §5318(g)",
      confidence: 0.97,
      trigger_reason: "4 suspicious transactions totaling $476",
    },
  ] as RegulatoryMapping[],
  risk_indicators: [
    "High-risk jurisdiction involvement: KY, RU",
    "Transaction velocity anomaly",
    "Peer group deviation",
  ] as RiskIndicators,
  evidence_summary: {
    transaction_records: 10,
    risk_score: 70,
    network_connections: 2,
    external_intelligence_hits: 0,
    detection_type: "pattern_based",
  } as EvidenceSummary,
  narrative_generation: {
    suspicious_activity_description:
      "Multiple irregular transactions detected involving high-risk jurisdictions with velocity anomalies and significant peer group deviations.",
    conclusion:
      "The account demonstrates clear indicators of suspicious activity requiring immediate investigation and regulatory reporting.",
  } as NarrativeGeneration,
};

const getRiskCategoryColor = (category: string) => {
  switch (category.toUpperCase()) {
    case "CRITICAL":
      return "bg-red-500/15 text-red-700 dark:text-red-400";
    case "HIGH":
      return "bg-orange-500/15 text-orange-700 dark:text-orange-400";
    case "MEDIUM":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    case "LOW":
      return "bg-green-500/15 text-green-700 dark:text-green-400";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const getConfidenceColor = (confidence: number) => {
  if (confidence >= 0.8) return "text-green-600 dark:text-green-400";
  if (confidence >= 0.6) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
};

export default function SARElements() {
  const [expandedEntity, setExpandedEntity] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"entities" | "changed" | "law_comparison" | "law_adaptation">("entities");

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">SAR Elements</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Comprehensive SAR case analysis with regulatory mapping and risk assessment
            </p>
          </div>
          <Badge variant="secondary" className="text-sm">
            {sarCaseData.metadata.case_id}
          </Badge>
        </div>
        <Card className="border-orange-500/40 bg-orange-500/5 shadow-card">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="flex-1 text-sm">
                <p className="font-semibold text-foreground">Active SAR Investigation</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Case: {sarCaseData.metadata.case_id} · Risk Score:{" "}
                  <span className="font-semibold text-orange-600">{sarCaseData.subject_profile.risk_score}</span> ·
                  Confidence: {(sarCaseData.metadata.ai_confidence * 100).toFixed(0)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section Navigation */}
      <div className="flex gap-2 border-b overflow-x-auto pb-0">
        <button
          onClick={() => setActiveSection("entities")}
          className={cn(
            "px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-[2px] whitespace-nowrap",
            activeSection === "entities"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          SAR Entities
        </button>
        <button
          onClick={() => setActiveSection("changed")}
          className={cn(
            "px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-[2px] whitespace-nowrap",
            activeSection === "changed"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Newly Changed Entities
        </button>
        <button
          onClick={() => setActiveSection("law_comparison")}
          className={cn(
            "px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-[2px] whitespace-nowrap",
            activeSection === "law_comparison"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Scale className="w-4 h-4 inline mr-1.5" />
          Law Comparison
        </button>
        <button
          onClick={() => setActiveSection("law_adaptation")}
          className={cn(
            "px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-[2px] whitespace-nowrap",
            activeSection === "law_adaptation"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <BookOpen className="w-4 h-4 inline mr-1.5" />
          Narrative Adaptation
        </button>
      </div>

      {/* SAR Entities Section */}
      {activeSection === "entities" && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Case metadata, customer profile, transaction analysis, and suspicious activity details
          </div>

          {/* Case Metadata Card */}
          <Card className="shadow-card hover:shadow-lg transition-shadow">
            <CardHeader
              className="pb-3 cursor-pointer hover:bg-muted/25 transition-colors"
              onClick={() =>
                setExpandedEntity(expandedEntity === "metadata" ? null : "metadata")
              }
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Code className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base">Case Metadata</CardTitle>
                    <CardDescription className="text-xs">
                      Report generation and system information
                    </CardDescription>
                  </div>
                </div>
                {expandedEntity === "metadata" ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
                )}
              </div>
            </CardHeader>

            {expandedEntity === "metadata" && (
              <CardContent className="pt-0 border-t">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground font-medium">Case ID</p>
                    <p className="font-mono text-sm font-semibold text-foreground mt-1">
                      {sarCaseData.metadata.case_id}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground font-medium">Generated</p>
                    <p className="font-mono text-sm font-semibold text-foreground mt-1">
                      {sarCaseData.metadata.date_generated}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground font-medium">Primary Country</p>
                    <p className="font-mono text-sm font-semibold text-foreground mt-1">
                      {sarCaseData.metadata.primary_country}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground font-medium">AI Confidence</p>
                    <p className={`font-mono text-sm font-semibold mt-1 ${getConfidenceColor(sarCaseData.metadata.ai_confidence)}`}>
                      {(sarCaseData.metadata.ai_confidence * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground font-medium">Regulatory Impact</p>
                    <p className={`font-mono text-sm font-semibold mt-1 ${getConfidenceColor(sarCaseData.metadata.regulatory_impact)}`}>
                      {(sarCaseData.metadata.regulatory_impact * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground font-medium">Reporting Unit</p>
                    <p className="text-xs font-semibold text-foreground mt-1">
                      {sarCaseData.metadata.reporting_unit}
                    </p>
                  </div>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 mt-3 font-mono text-xs overflow-auto">
                  <pre className="text-foreground">
                    {JSON.stringify(sarCaseData.metadata, null, 2)}
                  </pre>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Subject Profile Card */}
          <Card className="shadow-card hover:shadow-lg transition-shadow">
            <CardHeader
              className="pb-3 cursor-pointer hover:bg-muted/25 transition-colors"
              onClick={() =>
                setExpandedEntity(expandedEntity === "subject" ? null : "subject")
              }
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <Users className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base">Subject Profile</CardTitle>
                    <CardDescription className="text-xs">
                      Customer account and risk assessment
                    </CardDescription>
                  </div>
                  <Badge className={`text-xs ${getRiskCategoryColor(sarCaseData.subject_profile.risk_category)}`}>
                    {sarCaseData.subject_profile.risk_category}
                  </Badge>
                </div>
                {expandedEntity === "subject" ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
                )}
              </div>
            </CardHeader>

            {expandedEntity === "subject" && (
              <CardContent className="pt-0 border-t">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground font-medium">Account ID</p>
                    <p className="font-mono text-sm font-semibold text-foreground mt-1">
                      {sarCaseData.subject_profile.account_id}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground font-medium">Risk Score</p>
                    <p className="font-mono text-sm font-semibold text-orange-600 mt-1">
                      {sarCaseData.subject_profile.risk_score}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground font-medium">KYC Status</p>
                    <p className="text-xs font-semibold text-foreground mt-1">
                      {sarCaseData.subject_profile.kyc_status.replace("_", " ")}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 md:col-span-2">
                    <p className="text-[10px] text-muted-foreground font-medium">Institution</p>
                    <p className="text-xs font-semibold text-foreground mt-1">
                      {sarCaseData.subject_profile.institution}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground font-medium">Connections</p>
                    <p className="font-mono text-sm font-semibold text-foreground mt-1">
                      {sarCaseData.subject_profile.connections_count}
                    </p>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium mb-1.5">Relationship Types</p>
                    <div className="flex flex-wrap gap-2">
                      {sarCaseData.subject_profile.relationship_types.map((type) => (
                        <Badge key={type} variant="secondary" className="text-xs">
                          {type.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium mb-1.5">Countries Involved</p>
                    <div className="flex flex-wrap gap-2">
                      {sarCaseData.subject_profile.countries_involved.map((country) => (
                        <Badge key={country} variant="outline" className="text-xs">
                          {country}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 mt-3 font-mono text-xs overflow-auto">
                  <pre className="text-foreground">
                    {JSON.stringify(sarCaseData.subject_profile, null, 2)}
                  </pre>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Transaction Summary Card */}
          <Card className="shadow-card hover:shadow-lg transition-shadow">
            <CardHeader
              className="pb-3 cursor-pointer hover:bg-muted/25 transition-colors"
              onClick={() =>
                setExpandedEntity(expandedEntity === "transactions" ? null : "transactions")
              }
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base">Transaction Summary</CardTitle>
                    <CardDescription className="text-xs">
                      {sarCaseData.transaction_summary.review_period.start} to{" "}
                      {sarCaseData.transaction_summary.review_period.end}
                    </CardDescription>
                  </div>
                </div>
                {expandedEntity === "transactions" ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
                )}
              </div>
            </CardHeader>

            {expandedEntity === "transactions" && (
              <CardContent className="pt-0 border-t">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground font-medium">Total Amount</p>
                    <p className="font-mono text-sm font-semibold text-foreground mt-1">
                      ${sarCaseData.transaction_summary.total_amount}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground font-medium">Transaction Count</p>
                    <p className="font-mono text-sm font-semibold text-foreground mt-1">
                      {sarCaseData.transaction_summary.transaction_count}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground font-medium">Suspicious TXN</p>
                    <p className="font-mono text-sm font-semibold text-red-600 mt-1">
                      {sarCaseData.transaction_summary.suspicious_transaction_count}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground font-medium">Average Amount</p>
                    <p className="font-mono text-sm font-semibold text-foreground mt-1">
                      ${sarCaseData.transaction_summary.average_amount}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground font-medium">Max Transaction</p>
                    <p className="font-mono text-sm font-semibold text-foreground mt-1">
                      ${sarCaseData.transaction_summary.max_transaction}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground font-medium">Patterns</p>
                    <p className="text-xs font-semibold text-foreground mt-1">
                      {sarCaseData.transaction_summary.patterns_detected.join(", ")}
                    </p>
                  </div>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 mt-3 font-mono text-xs overflow-auto">
                  <pre className="text-foreground">
                    {JSON.stringify(sarCaseData.transaction_summary, null, 2)}
                  </pre>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Suspicious Transactions Card */}
          <Card className="shadow-card hover:shadow-lg transition-shadow">
            <CardHeader
              className="pb-3 cursor-pointer hover:bg-muted/25 transition-colors"
              onClick={() =>
                setExpandedEntity(expandedEntity === "suspicious" ? null : "suspicious")
              }
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-2 rounded-lg bg-red-500/10">
                    <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base">Suspicious Transaction Details</CardTitle>
                    <CardDescription className="text-xs">
                      Row-level suspicious activity records
                    </CardDescription>
                  </div>
                </div>
                {expandedEntity === "suspicious" ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
                )}
              </div>
            </CardHeader>

            {expandedEntity === "suspicious" && (
              <CardContent className="pt-0 border-t">
                <div className="space-y-2 mt-3">
                  {sarCaseData.suspicious_transactions.map((tx, idx) => (
                    <div key={idx} className="bg-muted/30 rounded-lg p-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-2">
                        <div>
                          <p className="text-muted-foreground font-medium">Date</p>
                          <p className="font-mono text-foreground">{tx.date}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground font-medium">Amount</p>
                          <p className="font-mono text-foreground">${tx.amount}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground font-medium">Type</p>
                          <p className="font-mono text-foreground">{tx.type}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground font-medium">From</p>
                          <p className="font-mono text-foreground text-[10px]">{tx.from_account}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {tx.indicator.map((ind) => (
                          <Badge key={ind} variant="outline" className="text-[9px]">
                            {ind}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-muted/30 rounded-lg p-3 mt-3 font-mono text-xs overflow-auto">
                  <pre className="text-foreground">
                    {JSON.stringify(sarCaseData.suspicious_transactions, null, 2)}
                  </pre>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      )}

      {/* Newly Changed Entities Section */}
      {activeSection === "changed" && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Regulatory mapping, risk indicators, evidence summary, and narrative analysis
          </div>

          {/* Regulatory Mapping Card */}
          <Card className="shadow-card hover:shadow-lg transition-shadow border-red-500/40">
            <CardHeader
              className="pb-3 cursor-pointer hover:bg-muted/25 transition-colors"
              onClick={() =>
                setExpandedEntity(expandedEntity === "regulatory" ? null : "regulatory")
              }
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-2 rounded-lg bg-red-500/10">
                    <Lock className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base">Regulatory Mapping ⚠️</CardTitle>
                    <CardDescription className="text-xs">
                      Critical compliance triggers and legal references
                    </CardDescription>
                  </div>
                  <Badge className={`text-xs ${getRiskCategoryColor("CRITICAL")}`}>CRITICAL</Badge>
                </div>
                {expandedEntity === "regulatory" ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
                )}
              </div>
            </CardHeader>

            {expandedEntity === "regulatory" && (
              <CardContent className="pt-0 border-t">
                <div className="space-y-3 mt-3">
                  {sarCaseData.regulatory_mapping.map((reg, idx) => (
                    <div key={idx} className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                      <div className="grid grid-cols-2 gap-3 text-xs mb-2">
                        <div>
                          <p className="text-muted-foreground font-medium">Regulation</p>
                          <p className="font-semibold text-foreground">{reg.regulation}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground font-medium">Reference</p>
                          <p className="font-mono text-foreground">{reg.reference}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-muted-foreground font-medium">Confidence</p>
                          <p className={`font-mono font-semibold ${getConfidenceColor(reg.confidence)}`}>
                            {(reg.confidence * 100).toFixed(0)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground font-medium">Trigger Reason</p>
                          <p className="text-foreground">{reg.trigger_reason}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-muted/30 rounded-lg p-3 mt-3 font-mono text-xs overflow-auto">
                  <pre className="text-foreground">
                    {JSON.stringify(sarCaseData.regulatory_mapping, null, 2)}
                  </pre>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Risk Indicators Card */}
          <Card className="shadow-card hover:shadow-lg transition-shadow">
            <CardHeader
              className="pb-3 cursor-pointer hover:bg-muted/25 transition-colors"
              onClick={() =>
                setExpandedEntity(expandedEntity === "indicators" ? null : "indicators")
              }
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-2 rounded-lg bg-yellow-500/10">
                    <TrendingUp className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base">Risk Indicators</CardTitle>
                    <CardDescription className="text-xs">
                      Explainability layer and Model reasoning
                    </CardDescription>
                  </div>
                </div>
                {expandedEntity === "indicators" ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
                )}
              </div>
            </CardHeader>

            {expandedEntity === "indicators" && (
              <CardContent className="pt-0 border-t">
                <div className="space-y-2 mt-3">
                  {sarCaseData.risk_indicators.map((indicator, idx) => (
                    <div key={idx} className="flex items-start gap-2 bg-muted/30 rounded-lg p-3">
                      <CheckCircle2 className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
                      <p className="text-sm text-foreground">{indicator}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-muted/30 rounded-lg p-3 mt-3 font-mono text-xs overflow-auto">
                  <pre className="text-foreground">
                    {JSON.stringify(sarCaseData.risk_indicators, null, 2)}
                  </pre>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Evidence Summary Card */}
          <Card className="shadow-card hover:shadow-lg transition-shadow">
            <CardHeader
              className="pb-3 cursor-pointer hover:bg-muted/25 transition-colors"
              onClick={() =>
                setExpandedEntity(expandedEntity === "evidence" ? null : "evidence")
              }
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-2 rounded-lg bg-cyan-500/10">
                    <CheckCircle2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base">Evidence Summary</CardTitle>
                    <CardDescription className="text-xs">
                      Audit layer and detection methodology
                    </CardDescription>
                  </div>
                </div>
                {expandedEntity === "evidence" ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
                )}
              </div>
            </CardHeader>

            {expandedEntity === "evidence" && (
              <CardContent className="pt-0 border-t">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground font-medium">TXN Records</p>
                    <p className="font-mono text-sm font-semibold text-foreground mt-1">
                      {sarCaseData.evidence_summary.transaction_records}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground font-medium">Risk Score</p>
                    <p className="font-mono text-sm font-semibold text-orange-600 mt-1">
                      {sarCaseData.evidence_summary.risk_score}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground font-medium">Connections</p>
                    <p className="font-mono text-sm font-semibold text-foreground mt-1">
                      {sarCaseData.evidence_summary.network_connections}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground font-medium">Intel Hits</p>
                    <p className="font-mono text-sm font-semibold text-foreground mt-1">
                      {sarCaseData.evidence_summary.external_intelligence_hits}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 md:col-span-2">
                    <p className="text-[10px] text-muted-foreground font-medium">Detection Type</p>
                    <p className="text-xs font-semibold text-foreground mt-1">
                      {sarCaseData.evidence_summary.detection_type.replace(/_/g, " ")}
                    </p>
                  </div>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 mt-3 font-mono text-xs overflow-auto">
                  <pre className="text-foreground">
                    {JSON.stringify(sarCaseData.evidence_summary, null, 2)}
                  </pre>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Narrative Generation Card */}
          <Card className="shadow-card hover:shadow-lg transition-shadow">
            <CardHeader
              className="pb-3 cursor-pointer hover:bg-muted/25 transition-colors"
              onClick={() =>
                setExpandedEntity(expandedEntity === "narrative" ? null : "narrative")
              }
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-2 rounded-lg bg-violet-500/10">
                    <Code className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base">Narrative Generation</CardTitle>
                    <CardDescription className="text-xs">
                      LLM-generated suspicious activity analysis (2025 Enhanced Law)
                    </CardDescription>
                  </div>
                </div>
                {expandedEntity === "narrative" ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
                )}
              </div>
            </CardHeader>

            {expandedEntity === "narrative" && (
              <CardContent className="pt-0 border-t">
                <div className="space-y-3 mt-3">
                  {/* Current Law Context */}
                  <div className="bg-green-500/5 border border-green-500/30 rounded-lg p-3">
                    <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-2">CURRENT LAW CONTEXT (2025 Enhanced)</p>
                    <p className="text-xs text-foreground leading-relaxed">
                      Account ACCT100192 represents a CRITICAL SAR case under the 2025 Enhanced Framework. The account triggers multiple enhanced detection criteria including dynamic threshold violations, AI-driven risk scoring, and enhanced beneficial ownership concerns. Expedited filing within 5 business days is required with enhanced beneficial ownership documentation.
                    </p>
                  </div>

                  {/* Original Narrative */}
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground font-medium mb-2">SUSPICIOUS ACTIVITY DESCRIPTION</p>
                    <p className="text-sm text-foreground leading-relaxed">
                      {sarCaseData.narrative_generation.suspicious_activity_description}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground font-medium mb-2">CONCLUSION</p>
                    <p className="text-sm text-foreground leading-relaxed">
                      {sarCaseData.narrative_generation.conclusion}
                    </p>
                  </div>

                  {/* Law Adaptation Notice */}
                  <div className="bg-blue-500/5 border border-blue-500/30 rounded-lg p-3">
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2">ℹ️ Law Adaptation Notice</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      This narrative is generated for the current 2025 Enhanced Law framework. The system automatically regenerates narratives based on applicable laws. Under the legacy 2024 framework, this case would be classified as "low" severity instead of "critical". Under the incoming 2026 Global framework, this case would require multi-jurisdiction cross-border reporting. Use the "Narrative Adaptation" tab to view law-specific narratives.
                    </p>
                  </div>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 mt-3 font-mono text-xs overflow-auto">
                  <pre className="text-foreground">
                    {JSON.stringify(sarCaseData.narrative_generation, null, 2)}
                  </pre>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      )}

      {/* Law Comparison Section */}
      {activeSection === "law_comparison" && (
        <LawComparisonDisplay />
      )}

      {/* Law Adaptation Section */}
      {activeSection === "law_adaptation" && (
        <LawAdaptationDisplay />
      )}

      {/* Footer */}
      <Card className="border-muted bg-muted/25">
        <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
          <p>
            <span className="font-semibold text-foreground">Model Version:</span> {sarCaseData.metadata.model_version}
          </p>
          <p>
            <span className="font-semibold text-foreground">Generated:</span> {sarCaseData.metadata.date_generated}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
