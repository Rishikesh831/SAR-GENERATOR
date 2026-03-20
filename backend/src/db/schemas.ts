import { pgTable, text, timestamp, decimal, jsonb, pgEnum, uuid, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const caseStatusEnum = pgEnum("case_status", [
    "INGESTED", "ENRICHING", "ANALYZING", "GENERATING_NARRATIVE", "COMPLETED", "FAILED"
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
    linkedTxIds: text("linked_tx_ids").array(), // PG Array
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// AuditLog Table
export const auditLogs = pgTable("audit_logs", {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id").references(() => cases.id).notNull(),
    action: text("action").notNull(),
    actor: text("actor").notNull(),
    payload: jsonb("payload"),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// RELATIONS (This makes joining tables easy in Drizzle)
export const casesRelations = relations(cases, ({ many }) => ({
    transactions: many(transactions),
    evidence: many(evidence),
    auditLogs: many(auditLogs),
}));