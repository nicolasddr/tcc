CREATE TABLE "input_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"content" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"used_at" timestamp with time zone,
	CONSTRAINT "ii_name_len" CHECK (char_length(name) <= 200),
	CONSTRAINT "ii_name_not_blank" CHECK (btrim(name) <> ''),
	CONSTRAINT "ii_content_len" CHECK (char_length(content) <= 50000),
	CONSTRAINT "ii_content_not_blank" CHECK (btrim(content) <> '')
);
--> statement-breakpoint
ALTER TABLE "input_items" ADD CONSTRAINT "input_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "input_items" ADD CONSTRAINT "input_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ii_project_created" ON "input_items" USING btree ("project_id","created_at");