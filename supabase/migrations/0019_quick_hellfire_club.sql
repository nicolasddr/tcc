ALTER TABLE "codebook_criteria" ADD COLUMN "high_description" text;--> statement-breakpoint
ALTER TABLE "codebook_criteria" ADD COLUMN "medium_description" text;--> statement-breakpoint
ALTER TABLE "codebook_criteria" ADD COLUMN "low_description" text;--> statement-breakpoint
ALTER TABLE "codebook_criteria" ADD CONSTRAINT "cc_high_description_len" CHECK (high_description IS NULL OR char_length(high_description) <= 500);--> statement-breakpoint
ALTER TABLE "codebook_criteria" ADD CONSTRAINT "cc_medium_description_len" CHECK (medium_description IS NULL OR char_length(medium_description) <= 500);--> statement-breakpoint
ALTER TABLE "codebook_criteria" ADD CONSTRAINT "cc_low_description_len" CHECK (low_description IS NULL OR char_length(low_description) <= 500);