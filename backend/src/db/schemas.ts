import { pgTable, text, timestamp, decimal, jsonb, pgEnum, uuid, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const caseStatusEnum = pgEnum("case_status", [
    "INGESTED",
    "ANALYZING",
    "FLAGGED",
    "DRAFT",
    "IN_REVIEW",
    "APPROVED",
    "FILED",
    "FAILED"
]);

export const riskLevelEnum = pgEnum("risk_level", [
    "LOW", "MEDIUM", "HIGH", "CRITICAL"
]);

// Case Table
export const cases = pgTable("cases", {
    id: uuid("id").primaryKey().defaultRandom(),
    status: caseStatusEnum("status").default("INGESTED").notNull(),
    riskScore: decimal("risk_score", { precision: 3, scale: 2 }),
    riskLevel: riskLevelEnum("risk_level").default("LOW"),
    mlInsights: jsonb("ml_insights"),

    // REASON: Storing customer info directly in the case for rapid development
    customerDetails: jsonb("customer_details"),

    // --- REGULATORY FIELDS ---
    jurisdiction: text("jurisdiction"),
    violatedLaws: text("violated_laws").array(),
    deadlineDate: timestamp("deadline_date"),

    pipelineStatus: jsonb("pipeline_status").default({
        ingestion: "completed",
        enrichment: "pending",
        ml_analysis: "pending",
        narrative_gen: "pending"
    }),

    complianceChecklist: jsonb("compliance_checklist").default({
        identity_verified: false,
        linked_tx_verified: false,
        narrative_confirmed: false,
        evidence_attached: false
    }),

    summaryLlm: text("summary_llm"),
    assignedTo: text("assigned_to"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Transaction Table
export const transactions = pgTable("transactions", {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id").references(() => cases.id, { onDelete: 'cascade' }).notNull(),
    externalTxId: text("external_tx_id"),
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
    currency: text("currency").default("INR").notNull(),
    timestamp: timestamp("timestamp").notNull(),
    senderDetails: jsonb("sender_details").notNull(),
    receiverDetails: jsonb("receiver_details").notNull(),
    category: text("category"),
    isFlagged: boolean("is_flagged").default(false).notNull(),
});

// Evidence Table
export const evidence = pgTable("evidence", {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id").references(() => cases.id, { onDelete: 'cascade' }).notNull(),
    evidenceType: text("evidence_type").notNull(),
    description: text("description").notNull(),
    linkedTxIds: text("linked_tx_ids").array(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// AuditLog Table
export const auditLogs = pgTable("audit_logs", {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id").references(() => cases.id).notNull(),
    action: text("action").notNull(),
    actor: text("actor").notNull(),
    payload: jsonb("payload"),
    // REASON: Essential for human-readable audit trails (Layer 7)
    details: text("details"),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// RELATIONS
export const casesRelations = relations(cases, ({ many }) => ({
    transactions: many(transactions),
    evidence: many(evidence),
    auditLogs: many(auditLogs),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
    case: one(cases, {
        fields: [transactions.caseId],
        references: [cases.id],
    }),
}));