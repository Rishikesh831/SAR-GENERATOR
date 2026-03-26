/**
 * Centralized API client for the yash backend.
 * All backend calls go through here. Every function is fire-and-forget safe —
 * if the backend is down, the frontend still works with synthetic data.
 */

// ─── Init Data ──────────────────────────────────────────────────────────────

export interface InitData {
  customers: any[];
  transactions: any[];
  sarReports: any[];
  auditEntries: any[];
}

/** GET /api/init — Single startup call, returns all data */
export async function fetchInitData(): Promise<InitData | null> {
  try {
    const res = await fetch("/api/init");
    if (!res.ok) throw new Error(`Init failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("⚠️ Backend unavailable:", (err as Error).message);
    return null;
  }
}

// ─── Case Mutations ─────────────────────────────────────────────────────────

/** PATCH /api/cases/:id — Generic case update */
export async function patchCase(dbId: string, updates: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`/api/cases/${dbId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
  } catch (err) {
    console.warn("Patch failed:", (err as Error).message);
  }
}

// ─── Pipeline ───────────────────────────────────────────────────────────────

/** POST /api/ingest — Ingest transactions, creates a new case */
export async function ingestTransactions(payload: {
  transactions: any[];
  customerMetadata?: any;
}): Promise<{ caseId: string } | null> {
  try {
    const res = await fetch("/api/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Ingest failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("Ingest failed:", (err as Error).message);
    return null;
  }
}

/** POST /api/cases/:id/analyze — Trigger ML analysis */
export async function analyzeCase(dbId: string): Promise<void> {
  try {
    await fetch(`/api/cases/${dbId}/analyze`, { method: "POST" });
  } catch (err) {
    console.warn("Analysis failed:", (err as Error).message);
  }
}

/** POST /api/cases/:id/evidence — Extract evidence */
export async function extractEvidence(dbId: string): Promise<void> {
  try {
    await fetch(`/api/cases/${dbId}/evidence`, { method: "POST" });
  } catch (err) {
    console.warn("Evidence extraction failed:", (err as Error).message);
  }
}

/** PATCH /api/cases/:id/checklist — Update compliance checklist */
export async function updateChecklist(
  dbId: string,
  checklist: Record<string, boolean>
): Promise<void> {
  try {
    await fetch(`/api/cases/${dbId}/checklist`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checklist }),
    });
  } catch (err) {
    console.warn("Checklist update failed:", (err as Error).message);
  }
}

/** POST /api/cases/:id/generate-narrative — Queue narrative (returns 202) */
export async function queueNarrative(dbId: string): Promise<{ jobId?: string } | null> {
  try {
    const res = await fetch(`/api/cases/${dbId}/generate-narrative`, {
      method: "POST",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.warn("Narrative queue failed:", body.message || res.status);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn("Narrative queue failed:", (err as Error).message);
    return null;
  }
}

/** GET /api/cases/:id/audit — Fetch audit trail */
export async function fetchAuditTrail(dbId: string): Promise<any[]> {
  try {
    const res = await fetch(`/api/cases/${dbId}/audit`);
    if (!res.ok) throw new Error(`Audit fetch failed: ${res.status}`);
    const data = await res.json();
    return data.data || data || [];
  } catch (err) {
    console.warn("Audit trail fetch failed:", (err as Error).message);
    return [];
  }
}
