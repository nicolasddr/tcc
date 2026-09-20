ALTER TABLE "responses" ADD CONSTRAINT "rs_unique_id_round" UNIQUE("id","round_id");--> statement-breakpoint
CREATE TABLE "consensus_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"response_id" uuid NOT NULL,
	"definition_id" uuid NOT NULL,
	"criterion_id" uuid NOT NULL,
	"project_member_id" uuid NOT NULL,
	"visibility" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cn_unique_cell_author" UNIQUE("response_id","definition_id","criterion_id","project_member_id"),
	CONSTRAINT "cn_visibility_check" CHECK (visibility = ANY (ARRAY['shared'::text, 'private'::text])),
	CONSTRAINT "cn_text_len" CHECK (char_length("text") <= 5000),
	CONSTRAINT "cn_text_not_blank" CHECK (btrim("text") <> '')
);
--> statement-breakpoint
ALTER TABLE "consensus_notes" ADD CONSTRAINT "consensus_notes_response_round_fkey" FOREIGN KEY ("response_id","round_id") REFERENCES "public"."responses"("id","round_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consensus_notes" ADD CONSTRAINT "consensus_notes_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "public"."codebook_definitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consensus_notes" ADD CONSTRAINT "consensus_notes_criterion_id_fkey" FOREIGN KEY ("criterion_id") REFERENCES "public"."codebook_criteria"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consensus_notes" ADD CONSTRAINT "consensus_notes_project_member_id_fkey" FOREIGN KEY ("project_member_id") REFERENCES "public"."project_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cn_response_visibility" ON "consensus_notes" USING btree ("response_id","visibility");--> statement-breakpoint
CREATE INDEX "cn_round_member" ON "consensus_notes" USING btree ("round_id","project_member_id");
