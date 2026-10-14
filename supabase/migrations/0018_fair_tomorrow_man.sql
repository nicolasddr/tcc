ALTER TABLE "codebook_definitions" DROP CONSTRAINT "codebook_definitions_type_check";--> statement-breakpoint
ALTER TABLE "codebook_definitions" ALTER COLUMN "type" DROP NOT NULL;--> statement-breakpoint
UPDATE "codebook_definitions" SET "type" = NULL WHERE "type" = 'guideline';--> statement-breakpoint
ALTER TABLE "codebook_definitions" ADD CONSTRAINT "codebook_definitions_type_check" CHECK (type = ANY (ARRAY['category'::text, 'quality_dimension'::text, 'generated_content'::text]));