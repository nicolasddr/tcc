CREATE TABLE "evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"response_id" uuid NOT NULL,
	"project_member_id" uuid NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ev_unique_response_member" UNIQUE("response_id","project_member_id")
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evaluation_id" uuid NOT NULL,
	"definition_id" uuid NOT NULL,
	"criterion_id" uuid NOT NULL,
	"value" text NOT NULL,
	"justification" text,
	CONSTRAINT "sc_unique_cell" UNIQUE("evaluation_id","definition_id","criterion_id"),
	CONSTRAINT "sc_value_check" CHECK (value = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text])),
	CONSTRAINT "sc_justification_len" CHECK (justification IS NULL OR char_length(justification) <= 2000)
);
--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "public"."responses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_project_member_id_fkey" FOREIGN KEY ("project_member_id") REFERENCES "public"."project_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "public"."codebook_definitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_criterion_id_fkey" FOREIGN KEY ("criterion_id") REFERENCES "public"."codebook_criteria"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ev_round_member" ON "evaluations" USING btree ("round_id","project_member_id");--> statement-breakpoint
CREATE INDEX "sc_evaluation" ON "scores" USING btree ("evaluation_id");