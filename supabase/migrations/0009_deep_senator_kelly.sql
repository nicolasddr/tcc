CREATE TABLE "codebook_criteria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codebook_version_id" uuid NOT NULL,
	"definition_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"order_index" integer NOT NULL,
	CONSTRAINT "cc_name_len" CHECK (char_length(name) <= 200),
	CONSTRAINT "cc_name_not_blank" CHECK (btrim(name) <> ''),
	CONSTRAINT "cc_description_len" CHECK (description IS NULL OR char_length(description) <= 2000)
);
--> statement-breakpoint
ALTER TABLE "codebook_criteria" ADD CONSTRAINT "codebook_criteria_codebook_version_id_fkey" FOREIGN KEY ("codebook_version_id") REFERENCES "public"."codebook_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "codebook_criteria" ADD CONSTRAINT "codebook_criteria_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "public"."codebook_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cc_version_order" ON "codebook_criteria" USING btree ("codebook_version_id","order_index");--> statement-breakpoint
CREATE INDEX "cc_definition_order" ON "codebook_criteria" USING btree ("definition_id","order_index");