const form = document.getElementById("upload-form");
const sarOutput = document.getElementById("sar-output");
const sarText = document.getElementById("sar-text");
const caseSummary = document.getElementById("case-summary");
const riskIndicators = document.getElementById("risk-indicators");
const pipelineStatus = document.getElementById("pipeline-status");
const pipelineTimeline = document.getElementById("pipeline-timeline");
const riskScorePanel = document.getElementById("risk-score");
const contributionBars = document.getElementById("contribution-bars");
const historyGraph = document.getElementById("history-graph");
const auditTrail = document.getElementById("audit-trail");
const reviewQueues = document.getElementById("review-queues");
const filingStatus = document.getElementById("filing-status");
const fileInput = form?.querySelector("input[type='file']");
const fileLabelText = form?.querySelector(".file-drop span");

const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:5050";

function renderSummary(report) {
  const meta = report.case_metadata || {};
  const subject = report.subject_profile || {};
  const summary = report.transaction_summary || {};

  caseSummary.innerHTML = `
    <div><strong>Case ID</strong>: ${meta.case_id || "-"}</div>
    <div><strong>Generated</strong>: ${meta.date_generated || "-"}</div>
    <div><strong>Risk Score</strong>: ${subject.risk_score || "-"}</div>
    <div><strong>Risk Category</strong>: ${subject.risk_category || "-"}</div>
    <div><strong>Transactions</strong>: ${summary.transaction_count || "-"}</div>
    <div><strong>Suspicious</strong>: ${summary.suspicious_transaction_count || "-"}</div>
  `;

  riskIndicators.innerHTML = "";
  const indicators = report.risk_indicators || [];
  if (!indicators.length) {
    riskIndicators.innerHTML = "<li class=\"muted\">No indicators yet.</li>";
    return;
  }
  indicators.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    riskIndicators.appendChild(li);
  });
}

function renderPipeline(statusLabel, activeIndex = 0) {
  if (pipelineStatus) {
    pipelineStatus.textContent = statusLabel;
  }
  if (!pipelineTimeline) return;
  const steps = Array.from(pipelineTimeline.querySelectorAll(".timeline-step"));
  steps.forEach((step, idx) => {
    step.classList.toggle("active", idx <= activeIndex);
  });
}

function renderRiskScore(report) {
  if (!riskScorePanel) return;
  const meta = report.case_metadata || {};
  const subject = report.subject_profile || {};
  const evidence = report.evidence_summary || {};
  riskScorePanel.innerHTML = `
    <div><strong>Total Risk Score</strong>: ${subject.risk_score ?? "-"}</div>
    <div><strong>Risk Category</strong>: ${subject.risk_category || "-"}</div>
    <div><strong>Detection Type</strong>: ${evidence.detection_type || "-"}</div>
    <div><strong>AI Confidence</strong>: ${meta.ai_confidence ?? "-"}</div>
  `;
}

function renderContribution(report) {
  if (!contributionBars) return;
  const indicators = report.risk_indicators || [];
  const patterns = report.transaction_summary?.patterns_detected || [];
  const base = 100 / Math.max(1, indicators.length + patterns.length);
  const items = [];
  indicators.forEach((item) => items.push({ label: item, value: base }));
  patterns.forEach((item) => items.push({ label: `Pattern: ${item}`, value: base }));
  if (!items.length) {
    items.push({ label: "Baseline Risk", value: 100 });
  }

  contributionBars.innerHTML = "";
  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <div class="bar-label"><span>${item.label}</span><span>${item.value.toFixed(0)}%</span></div>
      <div class="bar"><div class="bar-fill" style="width: ${item.value}%;"></div></div>
    `;
    contributionBars.appendChild(row);
  });
}

function renderHistory(audit) {
  if (!historyGraph) return;
  const events = audit?.audit_trail || [];
  const buckets = Array(6).fill(0);
  events.slice(-30).forEach((evt, idx) => {
    buckets[idx % buckets.length] += 1;
  });
  historyGraph.innerHTML = "";
  buckets.forEach((count) => {
    const bar = document.createElement("div");
    bar.className = "mini-bar";
    const height = Math.max(8, Math.min(120, count * 12));
    bar.style.height = `${height}px`;
    historyGraph.appendChild(bar);
  });
}

function renderAuditTrail(audit) {
  if (!auditTrail) return;
  const events = audit?.audit_trail || [];
  auditTrail.innerHTML = "";
  if (!events.length) {
    auditTrail.innerHTML = "<p class=\"muted\">No audit events.</p>";
    return;
  }
  events.slice(-12).forEach((evt) => {
    const item = document.createElement("div");
    item.className = "audit-item";
    item.innerHTML = `
      <strong>${evt.layer || "Layer"}: ${evt.action || "Action"}</strong>
      <span>${evt.timestamp || ""}</span>
      <div class="muted">${JSON.stringify(evt.details || {})}</div>
    `;
    auditTrail.appendChild(item);
  });
}

function renderQueues(report) {
  if (!reviewQueues) return;
  const meta = report.case_metadata || {};
  reviewQueues.innerHTML = "";
  const queues = [
    { title: "Draft", status: "Ready", note: "Initial SAR generated." },
    { title: "Junior Review", status: "Pending", note: "Checklist: 5W coverage." },
    { title: "Senior Review", status: "Pending", note: "Awaiting approval." },
  ];
  queues.forEach((queue) => {
    const item = document.createElement("div");
    item.className = "queue-item";
    item.innerHTML = `
      <strong>${queue.title}</strong>
      <div>Status: ${queue.status}</div>
      <p>${queue.note}</p>
      <span class="muted">Case: ${meta.case_id || "-"}</span>
    `;
    reviewQueues.appendChild(item);
  });
}

function renderFilingStatus(report) {
  if (!filingStatus) return;
  const subject = report.subject_profile || {};
  const isFiled = subject?.risk_category === "LOW";
  filingStatus.innerHTML = `
    <div class="status-pill ${isFiled ? "approved" : "pending"}">
      ${isFiled ? "Filed" : "Pending Approval"}
    </div>
    <div class="muted">${isFiled ? "SAR filed successfully." : "Awaiting senior approval before filing."}</div>
  `;
}

function formatReport(report) {
  if (!report || Object.keys(report).length === 0) {
    return "No SAR data available.";
  }

  const meta = report.case_metadata || {};
  const subject = report.subject_profile || {};
  const summary = report.transaction_summary || {};
  const indicators = report.risk_indicators || [];
  const evidence = report.evidence_summary || {};
  const regs = report.regulatory_mapping || [];
  const txs = report.suspicious_transactions || [];
  const narrative = report.narrative_generation || {};

  const lines = [];
  lines.push("SUSPICIOUS ACTIVITY REPORT (SAR)");
  lines.push("================================");
  lines.push(`Case ID: ${meta.case_id || "-"}`);
  lines.push(`Generated: ${meta.date_generated || "-"}`);
  lines.push(`Reporting Unit: ${meta.reporting_unit || "-"}`);
  lines.push(`Primary Country: ${meta.primary_country || "-"}`);
  lines.push(`AI Confidence: ${meta.ai_confidence ?? "-"}`);
  lines.push(`Regulatory Impact: ${meta.regulatory_impact ?? "-"}`);
  lines.push(`Model Version: ${meta.model_version || "-"}`);
  lines.push("");

  lines.push("SUBJECT PROFILE");
  lines.push("---------------");
  lines.push(`Account ID: ${subject.account_id || "-"}`);
  lines.push(`Risk Score: ${subject.risk_score ?? "-"}`);
  lines.push(`Risk Category: ${subject.risk_category || "-"}`);
  lines.push(`KYC Status: ${subject.kyc_status || "-"}`);
  lines.push(`Risk Types: ${(subject.risk_types || []).join(", ") || "-"}`);
  lines.push(`Connections: ${subject.connections_count ?? "-"}`);
  lines.push(`Relationship Types: ${(subject.relationship_types || []).join(", ") || "-"}`);
  lines.push(`Institution: ${subject.institution || "-"}`);
  lines.push(`Countries Involved: ${(subject.countries_involved || []).join(", ") || "-"}`);
  lines.push("");

  lines.push("TRANSACTION SUMMARY");
  lines.push("-------------------");
  lines.push(`Review Period: ${summary.review_period?.start || "-"} to ${summary.review_period?.end || "-"}`);
  lines.push(`Total Amount: ${summary.total_amount ?? "-"}`);
  lines.push(`Transaction Count: ${summary.transaction_count ?? "-"}`);
  lines.push(`Suspicious Transactions: ${summary.suspicious_transaction_count ?? "-"}`);
  lines.push(`Average Amount: ${summary.average_amount ?? "-"}`);
  lines.push(`Max Transaction: ${summary.max_transaction ?? "-"}`);
  lines.push(`Countries: ${(summary.countries || []).join(", ") || "-"}`);
  lines.push(`Patterns Detected: ${(summary.patterns_detected || []).join(", ") || "-"}`);
  lines.push("");

  lines.push("SUSPICIOUS TRANSACTION DETAILS");
  lines.push("------------------------------");
  if (!txs.length) {
    lines.push("No suspicious transactions listed.");
  } else {
    txs.forEach((tx, idx) => {
      lines.push(`(${idx + 1}) ${tx.date || "-"} | ${tx.type || "-"} | ${tx.amount ?? "-"}`);
      lines.push(`     From: ${tx.from_account || "-"} -> To: ${tx.to_account || "-"}`);
      lines.push(`     Indicators: ${(tx.indicator || []).join(", ") || "-"}`);
    });
  }
  lines.push("");

  lines.push("REGULATORY MAPPING");
  lines.push("------------------");
  if (!regs.length) {
    lines.push("No regulatory mapping provided.");
  } else {
    regs.forEach((rule, idx) => {
      lines.push(`(${idx + 1}) ${rule.severity || "-"} | ${rule.regulation || "-"}`);
      lines.push(`     Reference: ${rule.reference || "-"}`);
      lines.push(`     Confidence: ${rule.confidence ?? "-"}`);
      lines.push(`     Trigger: ${rule.trigger_reason || "-"}`);
    });
  }
  lines.push("");

  lines.push("RISK INDICATORS");
  lines.push("---------------");
  if (!indicators.length) {
    lines.push("No risk indicators recorded.");
  } else {
    indicators.forEach((item) => lines.push(`- ${item}`));
  }
  lines.push("");

  lines.push("EVIDENCE SUMMARY");
  lines.push("----------------");
  lines.push(`Transaction Records: ${evidence.transaction_records ?? "-"}`);
  lines.push(`Risk Score: ${evidence.risk_score ?? "-"}`);
  lines.push(`Network Connections: ${evidence.network_connections ?? "-"}`);
  lines.push(`External Intelligence Hits: ${evidence.external_intelligence_hits ?? "-"}`);
  lines.push(`Detection Type: ${evidence.detection_type || "-"}`);
  lines.push("");

  lines.push("NARRATIVE SUMMARY");
  lines.push("-----------------");
  lines.push(narrative.suspicious_activity_description || "-");
  lines.push("");
  lines.push(`Conclusion: ${narrative.conclusion || "-"}`);

  return lines.join("\n");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const file = data.get("transactions");
  if (!file || !(file instanceof File) || file.size === 0) {
    sarOutput.textContent = "Please select a CSV file first.";
    return;
  }
  sarOutput.textContent = "Running pipeline...";
  if (sarText) {
    sarText.textContent = "Running pipeline...";
  }

  try {
    renderPipeline("Running", 1);
    sarOutput.textContent = `Sending request to ${apiBase}...`;
    const response = await fetch(`${apiBase}/api/sar/generate`, {
      method: "POST",
      body: data,
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || `Request failed (${response.status})`);
    }

    const report = result.sar_report || {};
    const audit = result.audit_trail || {};
    renderSummary(report);
    renderPipeline("Complete", 4);
    renderRiskScore(report);
    renderContribution(report);
    renderHistory(audit);
    renderAuditTrail(audit);
    renderQueues(report);
    renderFilingStatus(report);
    sarOutput.textContent = JSON.stringify(report, null, 2);
    if (sarText) {
      sarText.textContent = formatReport(report);
    }
  } catch (err) {
    sarOutput.textContent = `Error: ${err.message}`;
    if (sarText) {
      sarText.textContent = `Error: ${err.message}`;
    }
    renderPipeline("Failed", 0);
  }
});

if (fileInput) {
  fileInput.addEventListener("change", () => {
    if (fileInput.files && fileInput.files.length > 0) {
      const name = fileInput.files[0].name;
      if (fileLabelText) {
        fileLabelText.textContent = `Selected: ${name}`;
      }
      form.requestSubmit();
    }
  });
}
