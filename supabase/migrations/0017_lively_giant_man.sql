ALTER TABLE "consensus_notes" DROP CONSTRAINT "cn_unique_cell_author";--> statement-breakpoint
ALTER TABLE "scores" DROP CONSTRAINT "sc_unique_cell";--> statement-breakpoint
ALTER TABLE "consensus_notes" DROP CONSTRAINT "consensus_notes_criterion_id_fkey";
--> statement-breakpoint
ALTER TABLE "scores" DROP CONSTRAINT "scores_criterion_id_fkey";
--> statement-breakpoint
ALTER TABLE "consensus_notes" ALTER COLUMN "definition_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scores" ALTER COLUMN "definition_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "codebook_criteria" ADD COLUMN "scope" text;--> statement-breakpoint
UPDATE "codebook_criteria" SET "scope" = CASE WHEN "definition_id" IS NULL THEN 'general' ELSE 'specific' END;--> statement-breakpoint
ALTER TABLE "codebook_criteria" ALTER COLUMN "scope" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "codebook_criteria" ADD COLUMN "per_response" boolean GENERATED ALWAYS AS (scope = 'per_response') STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "codebook_criteria" ADD CONSTRAINT "cc_unique_id_per_response" UNIQUE("id","per_response");--> statement-breakpoint
ALTER TABLE "consensus_notes" ADD COLUMN "per_response" boolean GENERATED ALWAYS AS (definition_id IS NULL) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "scores" ADD COLUMN "per_response" boolean GENERATED ALWAYS AS (definition_id IS NULL) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "consensus_notes" ADD CONSTRAINT "consensus_notes_criterion_scope_fkey" FOREIGN KEY ("criterion_id","per_response") REFERENCES "public"."codebook_criteria"("id","per_response") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_criterion_scope_fkey" FOREIGN KEY ("criterion_id","per_response") REFERENCES "public"."codebook_criteria"("id","per_response") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consensus_notes" ADD CONSTRAINT "cn_unique_cell_author" UNIQUE NULLS NOT DISTINCT("response_id","definition_id","criterion_id","project_member_id");--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "sc_unique_cell" UNIQUE NULLS NOT DISTINCT("evaluation_id","definition_id","criterion_id");--> statement-breakpoint
ALTER TABLE "codebook_criteria" ADD CONSTRAINT "cc_scope_check" CHECK (scope = ANY (ARRAY['specific'::text, 'general'::text, 'per_response'::text]));--> statement-breakpoint
ALTER TABLE "codebook_criteria" ADD CONSTRAINT "cc_scope_definition" CHECK ((scope = 'specific') = (definition_id IS NOT NULL));