CREATE TABLE "prompt_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"text" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"used_at" timestamp with time zone,
	CONSTRAINT "pv_unique_project_version" UNIQUE("project_id","version_number"),
	CONSTRAINT "pv_version_number_positive" CHECK (version_number >= 1),
	CONSTRAINT "pv_text_len" CHECK (char_length("text") <= 20000),
	CONSTRAINT "pv_text_not_blank" CHECK (btrim("text") <> '')
);
--> statement-breakpoint
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pv_project_version" ON "prompt_versions" USING btree ("project_id","version_number" DESC NULLS FIRST);