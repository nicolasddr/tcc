CREATE TABLE "responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"input_item_id" uuid NOT NULL,
	"text" text NOT NULL,
	"source" text DEFAULT 'generated' NOT NULL,
	"model" text NOT NULL,
	"model_version" text NOT NULL,
	"prompt_version_id" uuid NOT NULL,
	"codebook_version_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rs_unique_round_item" UNIQUE("round_id","input_item_id"),
	CONSTRAINT "responses_source_check" CHECK (source = ANY (ARRAY['generated'::text, 'pasted'::text])),
	CONSTRAINT "rs_text_len" CHECK (char_length("text") <= 50000),
	CONSTRAINT "rs_text_not_blank" CHECK (btrim("text") <> '')
);
--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_input_item_id_fkey" FOREIGN KEY ("input_item_id") REFERENCES "public"."input_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_prompt_version_id_fkey" FOREIGN KEY ("prompt_version_id") REFERENCES "public"."prompt_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_codebook_version_id_fkey" FOREIGN KEY ("codebook_version_id") REFERENCES "public"."codebook_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rs_round_created" ON "responses" USING btree ("round_id","created_at");