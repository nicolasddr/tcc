ALTER TABLE "rounds" ADD COLUMN "phase" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "rounds" ALTER COLUMN "phase" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rd_phase_range" CHECK (phase >= 2 AND phase <= 4);
