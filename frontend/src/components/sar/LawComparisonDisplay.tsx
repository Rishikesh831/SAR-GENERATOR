import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Scale,
  RefreshCw,
  TrendingUp,
  Lock,
  Globe,
  Calendar,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Law Version Interface
interface LawVersion {
  id: string;
  name: string;
  version: string;
  effectiveDate: string;
  jurisdiction: string;
  description: string;
  key_changes: string[];
  regulatory_references: RegulatoryReference[];
  status: "current" | "legacy" | "incoming";
}

// Regulatory Reference Interface
interface RegulatoryReference {
  code: string;
  section: string;
  title: string;
  threshold?: string;
  penalties?: string;
  updated_in_latest?: boolean;
}

// Activity Assessment Interface
interface ActivityAssessment {
  activity_id: string;
  activity_description: string;
  old_law_assessment: {
    violation: boolean;
    severity: "critical" | "high" | "medium" | "low" | "none";
    triggers: string[];
    confidence: number;
    regulatory_references: string[];
  };
  new_law_assessment: {
    violation: boolean;
    severity: "critical" | "high" | "medium" | "low" | "none";
    triggers: string[];
    confidence: number;
    regulatory_references: string[];
  };
  adaptation_impact: {
    classification_changed: boolean;
    severity_changed: boolean;
    new_triggers_added: string[];
    triggers_removed: string[];
    adaptation_notes: string;
  };
  timestamp: string;
}

// Sample Law Data
const lawVersions: LawVersion[] = [
  {
    id: "bsa-2024-base",
    name: "Bank Secrecy Act - 2024 Base",
    version: "2024.1",
    effectiveDate: "2024-01-01",
    jurisdiction: "US",
    description: "Standard BSA SAR reporting requirements with traditional thresholds",
    status: "legacy",
    key_changes: [],
    regulatory_references: [
      {
        code: "31 USC",
        section: "5318",
        title: "SAR Reporting Requirements",
        threshold: "$10,000",
        penalties: "Up to $25,000 per violation",
      },
      {
        code: "31 CFR",
        section: "1020.210",
        title: "Suspicious Activity Reporting",
        penalties: "Civil and criminal penalties",
      },
    ],
  },
  {
    id: "bsa-2025-enhanced",
    name: "Bank Secrecy Act - 2025 Enhanced",
    version: "2025.1",
    effectiveDate: "2025-03-01",
    jurisdiction: "US",
    description:
      "Enhanced SAR framework with AI-driven detection and dynamic thresholds for high-risk jurisdictions",
    status: "current",
    key_changes: [
      "AI-driven risk scoring integration",
      "Dynamic thresholds based on jurisdiction risk",
      "Enhanced beneficial ownership tracking",
      "Accelerated reporting for high-risk activities",
      "Real-time pattern detection requirements",
    ],
    regulatory_references: [
      {
        code: "31 USC",
        section: "5318",
        title: "SAR Reporting Requirements (Amended)",
        threshold: "$5,000 (High-Risk Jurisdictions)",
        penalties: "Up to $50,000 per violation",
        updated_in_latest: true,
      },
      {
        code: "31 CFR",
        section: "1020.210",
        title: "Suspicious Activity Reporting (Enhanced)",
        penalties: "Up to $100,000 per violation",
        updated_in_latest: true,
      },
      {
        code: "31 CFR",
        section: "1020.320",
        title: "AI-Driven Detection Integration (NEW)",
        updated_in_latest: true,
      },
    ],
  },
  {
    id: "bsa-2026-global",
    name: "Global AML Harmonization - 2026",
    version: "2026.1",
    effectiveDate: "2026-09-01",
    jurisdiction: "Global",
    description:
      "International AML harmonization with cross-border coordination and dynamic rule adaptation",
    status: "incoming",
    key_changes: [
      "Cross-border reporting coordination",
      "Dynamic rule adaptation based on global threats",
      "Integrated beneficial ownership registry",
      "Real-time jurisdiction risk updates",
      "Automated threshold adjustments",
      "Law-specific narrative adaptation",
    ],
    regulatory_references: [
      {
        code: "Global AML",
        section: "1.0",
        title: "Cross-Border SAR Requirements",
        threshold: "Dynamic based on jurisdiction",
        penalties: "Variable penalties",
        updated_in_latest: true,
      },
      {
        code: "International",
        section: "FATF 40",
        title: "FATF Recommendations (Updated)",
        penalties: "Jurisdictional enforcement",
        updated_in_latest: true,
      },
    ],
  },
];

// Sample Activity Assessments
const activityAssessments: ActivityAssessment[] = [
  {
    activity_id: "ACT001",
    activity_description: "Transaction to high-risk jurisdiction (RU) totaling $23K",
    old_law_assessment: {
      violation: false,
      severity: "low",
      triggers: ["high_risk_country"],
      confidence: 0.68,
      regulatory_references: ["31 USC 5318"],
    },
    new_law_assessment: {
      violation: true,
      severity: "high",
      triggers: ["high_risk_country", "dynamic_threshold_triggered", "enhanced_beneficial_ownership"],
      confidence: 0.94,
      regulatory_references: ["31 USC 5318 (Amended)", "31 CFR 1020.320"],
    },
    adaptation_impact: {
      classification_changed: true,
      severity_changed: true,
      new_triggers_added: ["dynamic_threshold_triggered", "enhanced_beneficial_ownership"],
      triggers_removed: [],
      adaptation_notes:
        "New 2025 law significantly lowered threshold for high-risk jurisdictions from $10K to $5K, and introduced AI-driven beneficial ownership tracking. This activity now triggers enhanced reporting requirements.",
    },
    timestamp: "2026-03-29T10:45:00Z",
  },
  {
    activity_id: "ACT002",
    activity_description: "Layered transactions across 4 countries in 48 hours ($144K total)",
    old_law_assessment: {
      violation: true,
      severity: "critical",
      triggers: ["layering", "rapid_multi_country", "amount_threshold"],
      confidence: 0.87,
      regulatory_references: ["31 USC 5318", "31 CFR 1020.210"],
    },
    new_law_assessment: {
      violation: true,
      severity: "critical",
      triggers: [
        "layering",
        "rapid_multi_country",
        "amount_threshold",
        "dynamic_risk_scoring",
        "pattern_acceleration_flag",
      ],
      confidence: 0.98,
      regulatory_references: ["31 USC 5318 (Amended)", "31 CFR 1020.320", "Global AML 1.0"],
    },
    adaptation_impact: {
      classification_changed: false,
      severity_changed: false,
      new_triggers_added: ["dynamic_risk_scoring", "pattern_acceleration_flag"],
      triggers_removed: [],
      adaptation_notes:
        "Activity remains critical violation under both laws. New law provides additional detection capabilities through real-time pattern acceleration flags and enhanced cross-border coordination.",
    },
    timestamp: "2026-03-29T12:30:00Z",
  },
  {
    activity_id: "ACT003",
    activity_description: "Rapid account activity spike, 15 transactions in 30 minutes",
    old_law_assessment: {
      violation: false,
      severity: "medium",
      triggers: ["velocity_anomaly"],
      confidence: 0.55,
      regulatory_references: ["31 USC 5318"],
    },
    new_law_assessment: {
      violation: true,
      severity: "high",
      triggers: ["velocity_anomaly", "real_time_detection", "pattern_acceleration"],
      confidence: 0.89,
      regulatory_references: ["31 CFR 1020.320", "Global AML 1.0"],
    },
    adaptation_impact: {
      classification_changed: true,
      severity_changed: true,
      new_triggers_added: ["real_time_detection", "pattern_acceleration"],
      triggers_removed: [],
      adaptation_notes:
        "2025 enhanced law requires real-time pattern detection, elevating this from medium concern to high violation. New 2026 global framework mandates immediate cross-border reporting.",
    },
    timestamp: "2026-03-29T14:15:00Z",
  },
];

function SeverityBadge({ severity }: { severity: string }) {
  const severityColors = {
    critical: "bg-red-500/15 text-red-700 dark:text-red-400",
    high: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
    medium: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    low: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    none: "bg-green-500/15 text-green-700 dark:text-green-400",
  };
  return (
    <Badge className={cn("text-xs capitalize", severityColors[severity as keyof typeof severityColors])}>
      {severity}
    </Badge>
  );
}

function LawVersionCard({ law, isActive }: { law: LawVersion; isActive: boolean }) {
  return (
    <Card
      className={cn(
        "shadow-card transition-all",
        isActive ? "border-blue-500/40 bg-blue-500/5 ring-2 ring-blue-500/20" : "border-border"
      )}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-lg">{law.name}</CardTitle>
              <Badge
                className={cn(
                  "text-xs",
                  law.status === "current"
                    ? "bg-green-500/15 text-green-700 dark:text-green-400"
                    : law.status === "incoming"
                      ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                      : "bg-gray-500/15 text-gray-700 dark:text-gray-400"
                )}
              >
                {law.status}
              </Badge>
            </div>
            <CardDescription className="text-xs">Version {law.version}</CardDescription>
          </div>
          <div className="text-right text-xs">
            <p className="text-muted-foreground">Effective</p>
            <p className="font-mono font-semibold text-foreground">{law.effectiveDate}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-foreground">{law.description}</p>

        {law.key_changes.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Key Changes:</p>
            <ul className="space-y-1">
              {law.key_changes.map((change, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-foreground">
                  <CheckCircle2 className="w-3 h-3 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                  <span>{change}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">Regulatory References:</p>
          <div className="space-y-1 max-h-[120px] overflow-y-auto">
            {law.regulatory_references.map((ref, idx) => (
              <div key={idx} className="bg-muted/30 rounded p-2 text-xs">
                <div className="flex items-start gap-2 mb-1">
                  <span className="font-mono font-semibold text-foreground">{ref.code}</span>
                  <span className="font-mono text-muted-foreground">§{ref.section}</span>
                  {ref.updated_in_latest && (
                    <Badge variant="secondary" className="text-[7px]">
                      NEW
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground">{ref.title}</p>
                {ref.threshold && <p className="text-foreground mt-1">Threshold: {ref.threshold}</p>}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityComparisonCard({ assessment }: { assessment: ActivityAssessment }) {
  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base">{assessment.activity_id}</CardTitle>
            <CardDescription className="text-xs mt-1">{assessment.activity_description}</CardDescription>
          </div>
          <div className="text-right text-xs shrink-0">
            <p className="text-muted-foreground">Assessed</p>
            <p className="font-mono text-foreground">
              {new Date(assessment.timestamp).toLocaleDateString()}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Old Law Assessment */}
          <div className="border border-border/50 rounded-lg p-3 bg-muted/20">
            <div className="flex items-center gap-2 mb-3">
              <Scale className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs font-semibold text-muted-foreground">2024 Law Assessment</p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Violation:</span>
                <Badge
                  className={cn(
                    "text-xs",
                    assessment.old_law_assessment.violation
                      ? "bg-red-500/15 text-red-700 dark:text-red-400"
                      : "bg-green-500/15 text-green-700 dark:text-green-400"
                  )}
                >
                  {assessment.old_law_assessment.violation ? "Yes" : "No"}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Severity:</span>
                <SeverityBadge severity={assessment.old_law_assessment.severity} />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Confidence:</span>
                <span className="font-mono font-semibold text-foreground">
                  {(assessment.old_law_assessment.confidence * 100).toFixed(0)}%
                </span>
              </div>

              <div className="pt-2 border-t border-border/30">
                <p className="text-muted-foreground mb-1.5">Triggers:</p>
                <div className="flex flex-wrap gap-1">
                  {assessment.old_law_assessment.triggers.map((trigger, idx) => (
                    <Badge key={idx} variant="outline" className="text-[9px]">
                      {trigger.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* New Law Assessment */}
          <div className="border border-green-500/30 rounded-lg p-3 bg-green-500/5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
              <p className="text-xs font-semibold text-green-700 dark:text-green-400">2025+ Enhanced Law Assessment</p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Violation:</span>
                <Badge
                  className={cn(
                    "text-xs",
                    assessment.new_law_assessment.violation
                      ? "bg-red-500/15 text-red-700 dark:text-red-400"
                      : "bg-green-500/15 text-green-700 dark:text-green-400"
                  )}
                >
                  {assessment.new_law_assessment.violation ? "Yes" : "No"}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Severity:</span>
                <SeverityBadge severity={assessment.new_law_assessment.severity} />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Confidence:</span>
                <span className="font-mono font-semibold text-foreground">
                  {(assessment.new_law_assessment.confidence * 100).toFixed(0)}%
                </span>
              </div>

              <div className="pt-2 border-t border-border/30">
                <p className="text-muted-foreground mb-1.5">Triggers:</p>
                <div className="flex flex-wrap gap-1">
                  {assessment.new_law_assessment.triggers.map((trigger, idx) => (
                    <Badge key={idx} variant="outline" className="text-[9px]">
                      {trigger.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Adaptation Impact */}
        {(assessment.adaptation_impact.classification_changed ||
          assessment.adaptation_impact.severity_changed ||
          assessment.adaptation_impact.new_triggers_added.length > 0 ||
          assessment.adaptation_impact.triggers_removed.length > 0) && (
          <div className="border border-blue-500/30 rounded-lg p-3 bg-blue-500/5">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">System Adaptation Impact</p>
            </div>

            <div className="space-y-2 text-xs">
              {assessment.adaptation_impact.classification_changed && (
                <p className="text-yellow-700 dark:text-yellow-400">
                  ⚠️ Classification changed under new law
                </p>
              )}
              {assessment.adaptation_impact.severity_changed && (
                <p className="text-orange-700 dark:text-orange-400">
                  ⚠️ Severity escalated under new law
                </p>
              )}

              {assessment.adaptation_impact.new_triggers_added.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-1">New Triggers Detected:</p>
                  <div className="flex flex-wrap gap-1 pl-2">
                    {assessment.adaptation_impact.new_triggers_added.map((trigger, idx) => (
                      <Badge key={idx} variant="secondary" className="text-[9px]">
                        {trigger.replace(/_/g, " ")}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {assessment.adaptation_impact.triggers_removed.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-1">Triggers Removed:</p>
                  <div className="flex flex-wrap gap-1 pl-2">
                    {assessment.adaptation_impact.triggers_removed.map((trigger, idx) => (
                      <Badge key={idx} variant="outline" className="text-[9px] opacity-50">
                        {trigger.replace(/_/g, " ")}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-background/50 rounded p-2 mt-2 border border-border/30">
                <p className="text-foreground">{assessment.adaptation_impact.adaptation_notes}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function LawComparisonDisplay() {
  const [selectedLawId, setSelectedLawId] = useState("bsa-2025-enhanced");
  const [filterSeverity, setFilterSeverity] = useState<string | null>(null);

  const filteredAssessments = filterSeverity
    ? activityAssessments.filter(
        (a) =>
          a.new_law_assessment.severity === filterSeverity ||
          a.old_law_assessment.severity === filterSeverity
      )
    : activityAssessments;

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Law Comparison & System Adaptation</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track how SAR detection adapts to regulatory law changes and compare suspicious activity assessments
            </p>
          </div>
          <Badge variant="secondary" className="text-sm h-fit">
            System v2.1 - Dynamic Law Sync
          </Badge>
        </div>

        <Card className="border-blue-500/40 bg-blue-500/5 shadow-card">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
              <div className="flex-1 text-sm">
                <p className="font-semibold text-foreground">Multi-Jurisdiction Law Tracking</p>
                <p className="text-muted-foreground text-xs mt-1">
                  System automatically adapts SAR reporting when laws change. Same suspicious activity classified
                  differently under old vs. new regulations. {lawVersions.length} law versions tracked across{" "}
                  {new Set(lawVersions.map((l) => l.jurisdiction)).size} jurisdictions.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="laws" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="laws" className="flex items-center gap-2">
            <Scale className="w-4 h-4" />
            Law Versions
          </TabsTrigger>
          <TabsTrigger value="assessments" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Activity Assessments
          </TabsTrigger>
        </TabsList>

        {/* Law Versions Tab */}
        <TabsContent value="laws" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 gap-4">
            {lawVersions.map((law) => (
              <div key={law.id} onClick={() => setSelectedLawId(law.id)} className="cursor-pointer">
                <LawVersionCard law={law} isActive={selectedLawId === law.id} />
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Activity Assessments Tab */}
        <TabsContent value="assessments" className="space-y-4 mt-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Filter by Severity:</span>
            {["critical", "high", "medium", "low", "none"].map((severity) => (
              <Button
                key={severity}
                variant={filterSeverity === severity ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterSeverity(filterSeverity === severity ? null : severity)}
                className="capitalize"
              >
                {severity}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredAssessments.length > 0 ? (
              filteredAssessments.map((assessment) => (
                <ActivityComparisonCard key={assessment.activity_id} assessment={assessment} />
              ))
            ) : (
              <Card className="shadow-card">
                <CardContent className="p-8 text-center">
                  <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No activities found matching the selected filters</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
