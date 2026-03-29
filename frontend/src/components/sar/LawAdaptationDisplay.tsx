import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  RefreshCw,
  Zap,
  FileText,
  Calendar,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Narrative Adaptation Interface
interface NarrativeAdaptation {
  case_id: string;
  base_narrative: string;
  law_specific_adaptations: LawAdaptation[];
  timestamp: string;
}

interface LawAdaptation {
  law_id: string;
  law_name: string;
  law_version: string;
  law_status: "legacy" | "current" | "incoming";
  adapted_narrative: string;
  key_adjustments: NarrativeAdjustment[];
  regulatory_references: string[];
  compliance_notes: string;
  timestamp: string;
}

interface NarrativeAdjustment {
  type: "threshold_adjustment" | "trigger_addition" | "emphasis_shift" | "reporting_acceleration" | "beneficial_owner_tracking";
  original_text: string;
  adapted_text: string;
  reason: string;
  impact: "critical" | "high" | "medium" | "low";
}

// Sample Narrative Adaptations
const narrativeAdaptations: NarrativeAdaptation = {
  case_id: "SAR-2026-63084",
  base_narrative:
    "Account ACCT100192 held by Barclays Bank PLC displays suspicious transaction patterns. Multiple irregular transactions involving high-risk jurisdictions (KY, RU) with transaction velocity anomalies have been identified. The account demonstrates clear indicators of suspicious activity requiring immediate investigation.",
  law_specific_adaptations: [
    {
      law_id: "bsa-2024-base",
      law_name: "Bank Secrecy Act - 2024 Base",
      law_version: "2024.1",
      law_status: "legacy",
      adapted_narrative:
        "Account ACCT100192 held by Barclays Bank PLC displays suspicious activity patterns under 31 USC §5318. Multiple transactions involving high-risk countries (KY, RU) exceed the standard SAR threshold of $10,000. Transaction velocity shows deviation from peer group norms. The cumulative suspicious indicators warrant SAR filing as per traditional BSA requirements.",
      key_adjustments: [
        {
          type: "threshold_adjustment",
          original_text: "Multiple irregular transactions involving high-risk jurisdictions",
          adapted_text: "Multiple transactions involving high-risk countries exceed the standard SAR threshold of $10,000",
          reason: "2024 law specifies $10,000 threshold for standard SAR reporting",
          impact: "high",
        },
        {
          type: "emphasis_shift",
          original_text: "transaction velocity anomalies",
          adapted_text: "transaction velocity shows deviation from peer group norms",
          reason: "2024 framework emphasizes peer comparison rather than absolute velocity",
          impact: "medium",
        },
        {
          type: "regulatory_references",
          original_text: "immediately",
          adapted_text: "as per traditional BSA requirements",
          reason: "Must reference specific statutory authority (31 USC §5318, 31 CFR 1020.210)",
          impact: "low",
        },
      ],
      regulatory_references: ["31 USC §5318(g)", "31 CFR §1020.210", "31 CFR §1020.210(a)(2)"],
      compliance_notes:
        "Under 2024 Base Law: Report within 30 business days. Standard threshold of $10,000 applies. Beneficial ownership verification required at account opening only.",
      timestamp: "2024-01-01T00:00:00Z",
    },
    {
      law_id: "bsa-2025-enhanced",
      law_name: "Bank Secrecy Act - 2025 Enhanced",
      law_version: "2025.1",
      law_status: "current",
      adapted_narrative:
        "Account ACCT100192 represents a CRITICAL SAR case under the 2025 Enhanced Framework (31 USC §5318 Amended, 31 CFR §1020.320). The account triggers multiple enhanced detection criteria:\n\n1. DYNAMIC THRESHOLD VIOLATION: Transactions to Cayman Islands (high-risk jurisdiction) total $476K, triggering the dynamic threshold of $5,000 for high-risk jurisdictions under real-time risk assessment (31 CFR §1020.320).\n\n2. AI-DRIVEN RISK SCORING: ML model risk score of 70/100 combined with confidence gradient of 0.72 exceeds the AI-driven threshold of 0.65 under the enhanced framework.\n\n3. BENEFICIAL OWNERSHIP CONCERN: Enhanced beneficial ownership tracking reveals institutional linkage to Barclays PLC (tier-2 international entity) requiring accelerated investigation per 31 CFR §1020.320(c).\n\n4. REAL-TIME PATTERN DETECTION: Transaction clustering analysis identifies 4 suspicious transactions within review period, indicating possible layering and rapid-fire fund movement patterns.\n\n5. CROSS-BORDER COORDINATION FLAG: Involvement of 7 countries (KY, UK, RU, US, AE, CN, IN) triggers cross-jurisdictional reporting coordination requirements.\n\nRecommendation: FILE EXPEDITED SAR within 5 business days with enhanced beneficial ownership documentation. Recommend enhanced due diligence cascade and potential account remediation.",
      key_adjustments: [
        {
          type: "threshold_adjustment",
          original_text: "Multiple transactions involving high-risk countries exceed the standard SAR threshold of $10,000",
          adapted_text: "Transactions to Cayman Islands trigger the dynamic threshold of $5,000 for high-risk jurisdictions",
          reason: "2025 law introduces dynamic thresholds based on jurisdiction risk - reduced from $10K to $5K for high-risk jurisdictions",
          impact: "critical",
        },
        {
          type: "trigger_addition",
          original_text: "transaction velocity shows deviation from peer group norms",
          adapted_text: "ML model risk score of 70/100 combined with confidence gradient of 0.72 exceeds the AI-driven threshold",
          reason: "2025 framework mandates AI-driven risk scoring integration - new trigger unavailable in 2024 law",
          impact: "critical",
        },
        {
          type: "beneficial_owner_tracking",
          original_text: "Account ACCT100192 held by Barclays Bank PLC",
          adapted_text: "Enhanced beneficial ownership tracking reveals institutional linkage to Barclays PLC requiring accelerated investigation",
          reason: "2025 law requires enhanced beneficial ownership tracking for all high-risk accounts",
          impact: "high",
        },
        {
          type: "reporting_acceleration",
          original_text: "SAR filing as per traditional BSA requirements",
          adapted_text: "FILE EXPEDITED SAR within 5 business days with enhanced beneficial ownership documentation",
          reason: "2025 framework mandates expedited reporting (5 days vs. 30 days) for critical-severity cases",
          impact: "critical",
        },
        {
          type: "emphasis_shift",
          original_text: "cumulative suspicious indicators",
          adapted_text: "Real-time pattern detection identifies 4 suspicious transactions indicating possible layering and rapid-fire fund movement",
          reason: "2025 law requires real-time pattern detection and explicit identification of specific typologies",
          impact: "high",
        },
      ],
      regulatory_references: [
        "31 USC §5318 (Amended 2025)",
        "31 CFR §1020.210 (Enhanced)",
        "31 CFR §1020.320 (NEW - AI-Driven Detection)",
        "31 CFR §1020.320(c) (NEW - Beneficial Ownership)",
      ],
      compliance_notes:
        "Under 2025 Enhanced Law: FILE EXPEDITED within 5 business days. Dynamic threshold of $5K applies to high-risk jurisdictions. AI risk scoring required. Enhanced beneficial ownership documentation mandatory. Real-time pattern detection integration required. Cross-border coordination reporting required for multi-jurisdictional cases.",
      timestamp: "2025-03-01T00:00:00Z",
    },
    {
      law_id: "bsa-2026-global",
      law_name: "Global AML Harmonization - 2026",
      law_version: "2026.1",
      law_status: "incoming",
      adapted_narrative:
        "GLOBAL AML HARMONIZATION ALERT - Case SAR-2026-63084 triggers multiple provisions under the International Framework (Global AML 1.0, FATF 40 Standards):\n\n🔴 CRITICAL SEVERITY - Multi-Jurisdiction Risk Composite Score: 8.7/10\n\nCROSS-BORDER ESCALATION PROTOCOL ACTIVATED:\n1. Primary Jurisdiction: Cayman Islands (Risk Index: HIGH)\n2. Secondary Jurisdictions: Russia (Risk Index: VERY HIGH), United Arab Emirates, China (Risk Index: HIGH)\n3. Cross-Border Coordination: ✓ Required\n4. Beneficial Ownership Registry Match: ✓ Flagged for international review\n\nDYNAMIC RULE ADAPTATION ANALYSIS:\nBased on current global threat intelligence, threshold has been dynamically adjusted to $2,000 for transactions involving Russia and China (up from $5,000 in previous framework). This case exceeds multiple dynamic thresholds simultaneously.\n\nREAL-TIME SYNCHRONIZED NARRATIVE:\nThe same activity identified as 'medium concern' in 2024 is now classified as CRITICAL under 2026 Global Framework due to:\n- Escalated Russia risk classification (new sanctions regime effective 2026-01-15)\n- China enhanced monitoring protocol (new FATF recommendation 40.2 - updated 2025-06-01)\n- Dynamic beneficial ownership linking to shell entity patterns detected by global AI mesh\n\nAUTOMATIC CROSS-BORDER REPORTING:\n✓ FinCEN (US): Expedited - within 2 business days\n✓ FCA (UK): Standard - within 5 business days  \n✓ Cayman Islands Monetary Authority: Coordinated - within 3 business days\n✓ Interpol Financial Crime Unit: Intelligence - within 1 business day\n\nSYSTEM SYNCHRONIZATION STATUS: ✓ SYNCHRONIZED\nThe system has automatically adapted all detection rules, thresholds, and reporting requirements based on real-time global law changes. Same suspicious activity is now flagged with HIGHER SEVERITY than 2025 assessment due to dynamic risk updates.",
      key_adjustments: [
        {
          type: "threshold_adjustment",
          original_text: "Transactions to Cayman Islands trigger the dynamic threshold of $5,000 for high-risk jurisdictions",
          adapted_text: "Dynamic threshold has been adjusted to $2,000 for transactions involving Russia and China based on current global threat intelligence and real-time sanctions regime updates",
          reason: "2026 Global Framework implements real-time dynamic threshold adjustments based on global threat intelligence and sanctions changes",
          impact: "critical",
        },
        {
          type: "trigger_addition",
          original_text: "involvement of 7 countries",
          adapted_text: "Primary Jurisdiction: Cayman Islands (Risk Index: HIGH), Secondary Jurisdictions: Russia (Risk Index: VERY HIGH), United Arab Emirates, China (Risk Index: HIGH). Cross-Border Coordination required.",
          reason: "2026 Global Framework mandates cross-border coordination protocol with real-time jurisdiction risk indexing",
          impact: "critical",
        },
        {
          type: "beneficial_owner_tracking",
          original_text: "Enhanced beneficial ownership tracking reveals institutional linkage",
          adapted_text: "Beneficial Ownership Registry Match: ✓ Flagged for international review. Shell entity patterns detected by global AI mesh",
          reason: "2026 Global Framework integrates international beneficial ownership registry and AI mesh pattern detection",
          impact: "critical",
        },
        {
          type: "reporting_acceleration",
          original_text: "FILE EXPEDITED SAR within 5 business days",
          adapted_text: "Automatic cross-border reporting: FinCEN (US) within 2 days, FCA (UK) within 5 days, Cayman Islands within 3 days, Interpol within 1 day",
          reason: "2026 Global Framework implements automatic cross-border reporting with jurisdiction-specific timelines",
          impact: "critical",
        },
        {
          type: "emphasis_shift",
          original_text: "Real-time pattern detection",
          adapted_text: "SYSTEM SYNCHRONIZATION: System dynamically adapted all detection rules based on real-time global law changes. Russia risk escalated (new sanctions 2026-01-15), China enhanced monitoring (FATF 40.2 update 2025-06-01)",
          reason: "2026 Global Framework requires demonstrating automatic synchronization of rules and dynamic risk recalculation",
          impact: "critical",
        },
      ],
      regulatory_references: [
        "Global AML 1.0 (International Framework)",
        "FATF Recommendation 40 (Updated 2025)",
        "FATF Recommendation 40.2 - China Monitoring (NEW 2025-06-01)",
        "International Sanction Regime - Russia (Updated 2026-01-15)",
        "International Beneficial Ownership Registry (IBOR v2.0)",
      ],
      compliance_notes:
        "Under 2026 Global AML Harmonization: AUTOMATIC MULTI-JURISDICTION REPORTING ACTIVATED. Dynamic thresholds adjusted real-time based on global threat intelligence. Beneficial ownership must be cross-referenced with International Registry. All detection rules synchronized with latest FATF recommendations and sanctions regimes. System demonstrates seamless adaptation to regulatory changes.",
      timestamp: "2026-03-01T00:00:00Z",
    },
  ],
};

function NarrativeAdaptationCard({
  adaptation,
  isLatest,
}: {
  adaptation: LawAdaptation;
  isLatest: boolean;
}) {
  return (
    <Card
      className={cn(
        "shadow-card transition-all",
        isLatest && adaptation.law_status === "current"
          ? "border-green-500/40 bg-green-500/5 ring-2 ring-green-500/20"
          : adaptation.law_status === "incoming"
            ? "border-blue-500/40 bg-blue-500/5"
            : "border-gray-400/40 bg-gray-400/5 opacity-75"
      )}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-lg">{adaptation.law_name}</CardTitle>
              <Badge
                className={cn(
                  "text-xs",
                  adaptation.law_status === "current"
                    ? "bg-green-500/15 text-green-700 dark:text-green-400"
                    : adaptation.law_status === "incoming"
                      ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                      : "bg-gray-500/15 text-gray-700 dark:text-gray-400"
                )}
              >
                {adaptation.law_status}
              </Badge>
            </div>
            <CardDescription className="text-xs">Version {adaptation.law_version}</CardDescription>
          </div>
          <div className="text-right text-xs shrink-0">
            <p className="text-muted-foreground">Effective</p>
            <p className="font-mono text-foreground">
              {new Date(adaptation.timestamp).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Compliance Notes Alert */}
        <div className="bg-background/50 rounded-lg p-2 text-xs border border-border/50">
          <p className="font-semibold text-foreground mb-1">Compliance Requirements:</p>
          <p className="text-muted-foreground">{adaptation.compliance_notes}</p>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Main Adapted Narrative */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            ADAPTED NARRATIVE
          </p>
          <div className="bg-muted/30 rounded-lg p-3 text-sm text-foreground leading-relaxed whitespace-pre-wrap font-mono text-xs">
            {adaptation.adapted_narrative}
          </div>
        </div>

        {/* Key Adjustments */}
        {adaptation.key_adjustments.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              KEY NARRATIVE ADAPTATIONS
            </p>
            <div className="space-y-2">
              {adaptation.key_adjustments.map((adjustment, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "border rounded-lg p-3 space-y-2",
                    adjustment.impact === "critical"
                      ? "border-red-500/30 bg-red-500/5"
                      : adjustment.impact === "high"
                        ? "border-orange-500/30 bg-orange-500/5"
                        : adjustment.impact === "medium"
                          ? "border-yellow-500/30 bg-yellow-500/5"
                          : "border-blue-500/30 bg-blue-500/5"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <Badge variant="outline" className="text-[9px] mb-2 capitalize">
                        {adjustment.type.replace(/_/g, " ")}
                      </Badge>
                      <Badge
                        className={cn(
                          "text-[9px] ml-2",
                          adjustment.impact === "critical"
                            ? "bg-red-500/15 text-red-700 dark:text-red-400"
                            : adjustment.impact === "high"
                              ? "bg-orange-500/15 text-orange-700 dark:text-orange-400"
                              : adjustment.impact === "medium"
                                ? "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400"
                                : "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                        )}
                      >
                        Impact: {adjustment.impact}
                      </Badge>
                    </div>
                  </div>

                  <div className="text-xs space-y-1">
                    <div>
                      <p className="text-muted-foreground font-medium">Original:</p>
                      <p className="bg-background/50 rounded p-2 italic text-foreground">
                        "{adjustment.original_text}"
                      </p>
                    </div>

                    <ArrowRight className="w-3 h-3 text-muted-foreground mx-2" />

                    <div>
                      <p className="text-muted-foreground font-medium">Adapted:</p>
                      <p className="bg-background/50 rounded p-2 font-semibold text-foreground">
                        "{adjustment.adapted_text}"
                      </p>
                    </div>

                    <div className="pt-2 border-t border-border/30">
                      <p className="text-muted-foreground">
                        <span className="font-semibold">Why:</span> {adjustment.reason}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Regulatory References */}
        {adaptation.regulatory_references.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              REGULATORY REFERENCES
            </p>
            <div className="flex flex-wrap gap-2">
              {adaptation.regulatory_references.map((ref, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {ref}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function LawAdaptationDisplay() {
  const [expandedLaw, setExpandedLaw] = useState<string | null>("bsa-2025-enhanced");

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">SAR Narrative Law Adaptation</h1>
            <p className="text-sm text-muted-foreground mt-1">
              View how SAR report narratives automatically adapt when regulatory laws change
            </p>
          </div>
          <Badge variant="secondary" className="text-sm h-fit flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Real-Time Sync Enabled
          </Badge>
        </div>

        <Card className="border-blue-500/40 bg-blue-500/5 shadow-card">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
              <div className="flex-1 text-sm">
                <p className="font-semibold text-foreground">Automatic Narrative Synchronization</p>
                <p className="text-muted-foreground text-xs mt-1">
                  This SAR case ({narrativeAdaptations.case_id}) demonstrates how the same suspicious activity is
                  described differently based on applicable laws. The system automatically regenerates narrative text,
                  adjusts thresholds, adds new triggers, and updates compliance requirements whenever laws change. This
                  ensures maximum regulatory synchronization and seamless law adaptability.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timeline of Law Effectiveness */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {narrativeAdaptations.law_specific_adaptations.map((adaptation, idx) => (
            <div key={adaptation.law_id} className="flex items-center gap-2 shrink-0">
              <Button
                variant={expandedLaw === adaptation.law_id ? "default" : "outline"}
                size="sm"
                onClick={() => setExpandedLaw(expandedLaw === adaptation.law_id ? null : adaptation.law_id)}
                className={cn(
                  adaptation.law_status === "current" && "border-green-500/40 bg-green-500/5 text-green-700"
                )}
              >
                <Calendar className="w-3 h-3 mr-1.5" />
                {new Date(adaptation.timestamp).getFullYear()}
              </Button>
              {idx < narrativeAdaptations.law_specific_adaptations.length - 1 && (
                <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Narrative Adaptations */}
      <div className="space-y-4">
        {narrativeAdaptations.law_specific_adaptations.map((adaptation) => (
          <NarrativeAdaptationCard
            key={adaptation.law_id}
            adaptation={adaptation}
            isLatest={adaptation.law_status === "current"}
          />
        ))}
      </div>

      {/* System Capability Summary */}
      <Card className="shadow-card border-green-500/40 bg-green-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <CheckCircle2 className="w-5 h-5" />
            System Adaptation Capabilities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-semibold text-foreground mb-2">✓ Dynamic Threshold Adjustment</p>
              <p className="text-muted-foreground text-xs">
                Automatically detects law changes and recalculates SAR thresholds based on updated regulations
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-2">✓ Real-Time Trigger Detection</p>
              <p className="text-muted-foreground text-xs">
                New regulatory triggers are automatically integrated into risk assessment models
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-2">✓ Narrative Regeneration</p>
              <p className="text-muted-foreground text-xs">
                SAR narratives are intelligently regenerated to reflect current legal requirements and comply with new
                regulations
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-2">✓ Beneficial Ownership Tracking</p>
              <p className="text-muted-foreground text-xs">
                Enhanced beneficial ownership requirements are automatically applied based on law version
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-2">✓ Reporting Timeline Synchronization</p>
              <p className="text-muted-foreground text-xs">
                Reporting deadlines and procedures automatically update when laws change (e.g., 30 days → 5 days → 2
                days)
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-2">✓ Cross-Border Coordination</p>
              <p className="text-muted-foreground text-xs">
                Multi-jurisdiction requirements automatically synchronized and coordinated across different jurisdictions
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
