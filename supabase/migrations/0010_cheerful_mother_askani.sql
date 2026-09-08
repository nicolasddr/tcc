CREATE TABLE "rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"codebook_version_id" uuid NOT NULL,
	"prompt_version_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "rd_unique_project_number" UNIQUE("project_id","round_number"),
	CONSTRAINT "rounds_status_check" CHECK (status = ANY (ARRAY['open'::text, 'closed'::text])),
	CONSTRAINT "rd_round_number_positive" CHECK (round_number >= 1),
	CONSTRAINT "rd_closed_at_matches_status" CHECK ((status = 'open'::text AND closed_at IS NULL) OR (status = 'closed'::text AND closed_at IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_codebook_version_id_fkey" FOREIGN KEY ("codebook_version_id") REFERENCES "public"."codebook_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_prompt_version_id_fkey" FOREIGN KEY ("prompt_version_id") REFERENCES "public"."prompt_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rd_project_number" ON "rounds" USING btree ("project_id","round_number");--> statement-breakpoint
CREATE UNIQUE INDEX "rd_one_open_per_project" ON "rounds" USING btree ("project_id") WHERE (status = 'open'::text);