CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_id" text,
	"name" text NOT NULL,
	"accounts" text[] DEFAULT '{}',
	"risk_rating" text DEFAULT 'low',
	"kyc_status" text DEFAULT 'pending',
	"business_type" text,
	"country" text,
	"flag_count" numeric(10, 0) DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customers_display_id_unique" UNIQUE("display_id")
);
--> statement-breakpoint
ALTER TABLE "cases" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "cases" ALTER COLUMN "status" SET DEFAULT 'INGESTED'::text;--> statement-breakpoint
DROP TYPE "public"."case_status";--> statement-breakpoint
CREATE TYPE "public"."case_status" AS ENUM('INGESTED', 'ANALYZING', 'FLAGGED', 'DRAFT', 'IN_REVIEW', 'IN_QUEUE', 'APPROVED', 'FILED', 'FAILED');--> statement-breakpoint
ALTER TABLE "cases" ALTER COLUMN "status" SET DEFAULT 'INGESTED'::"public"."case_status";--> statement-breakpoint
ALTER TABLE "cases" ALTER COLUMN "status" SET DATA TYPE "public"."case_status" USING "status"::"public"."case_status";--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "details" text;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "display_id" text;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "customer_details" jsonb;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "customer_id" uuid;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "jurisdiction" text;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "violated_laws" text[];--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "deadline_date" timestamp;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "pipeline_status" jsonb DEFAULT '{"ingestion":"completed","enrichment":"pending","ml_analysis":"pending","narrative_gen":"pending"}'::jsonb;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "compliance_checklist" jsonb DEFAULT '{"identity_verified":false,"linked_tx_verified":false,"narrative_confirmed":false,"evidence_attached":false}'::jsonb;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "display_id" text;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_display_id_unique" UNIQUE("display_id");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_display_id_unique" UNIQUE("display_id");