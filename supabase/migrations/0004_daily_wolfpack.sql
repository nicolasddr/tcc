CREATE TABLE "codebook_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codebook_version_id" uuid NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"order_index" integer NOT NULL,
	CONSTRAINT "codebook_definitions_type_check" CHECK (type = ANY (ARRAY['category'::text, 'quality_dimension'::text, 'guideline'::text])),
	CONSTRAINT "cd_title_len" CHECK (char_length(title) <= 200)
);
--> statement-breakpoint
CREATE TABLE "codebook_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"note" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"used_at" timestamp with time zone,
	CONSTRAINT "cv_unique_project_version" UNIQUE("project_id","version_number"),
	CONSTRAINT "cv_version_number_positive" CHECK (version_number >= 1),
	CONSTRAINT "cv_note_len" CHECK (note IS NULL OR char_length(note) <= 2000)
);
--> statement-breakpoint
ALTER TABLE "codebook_definitions" ADD CONSTRAINT "codebook_definitions_codebook_version_id_fkey" FOREIGN KEY ("codebook_version_id") REFERENCES "public"."codebook_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "codebook_versions" ADD CONSTRAINT "codebook_versions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "codebook_versions" ADD CONSTRAINT "codebook_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cd_version_order" ON "codebook_definitions" USING btree ("codebook_version_id","order_index");--> statement-breakpoint
CREATE INDEX "cv_project_version" ON "codebook_versions" USING btree ("project_id","version_number" DESC NULLS FIRST);