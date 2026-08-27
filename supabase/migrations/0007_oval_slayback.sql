ALTER TABLE "prompt_versions" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "prompt_versions" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "prompt_versions" ADD COLUMN "change_log" text;--> statement-breakpoint
ALTER TABLE "prompt_versions" ADD CONSTRAINT "pv_name_len" CHECK (name IS NULL OR char_length(name) <= 200);--> statement-breakpoint
ALTER TABLE "prompt_versions" ADD CONSTRAINT "pv_description_len" CHECK (description IS NULL OR char_length(description) <= 2000);--> statement-breakpoint
ALTER TABLE "prompt_versions" ADD CONSTRAINT "pv_change_log_len" CHECK (change_log IS NULL OR char_length(change_log) <= 2000);