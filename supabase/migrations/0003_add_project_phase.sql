ALTER TABLE "projects" ADD COLUMN "phase" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_phase_check" CHECK (phase >= 1 AND phase <= 4);