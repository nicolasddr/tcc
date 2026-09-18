CREATE TABLE "round_outliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"project_member_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"marked_by" uuid NOT NULL,
	"marked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_by" uuid,
	"removed_at" timestamp with time zone,
	CONSTRAINT "ro_removal_paired" CHECK ((removed_at IS NULL AND removed_by IS NULL) OR (removed_at IS NOT NULL AND removed_by IS NOT NULL)),
	CONSTRAINT "ro_reason_len" CHECK (char_length(reason) <= 2000),
	CONSTRAINT "ro_reason_not_blank" CHECK (btrim(reason) <> '')
);
--> statement-breakpoint
ALTER TABLE "round_outliers" ADD CONSTRAINT "round_outliers_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_outliers" ADD CONSTRAINT "round_outliers_project_member_id_fkey" FOREIGN KEY ("project_member_id") REFERENCES "public"."project_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_outliers" ADD CONSTRAINT "round_outliers_marked_by_fkey" FOREIGN KEY ("marked_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_outliers" ADD CONSTRAINT "round_outliers_removed_by_fkey" FOREIGN KEY ("removed_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ro_one_active_per_member" ON "round_outliers" USING btree ("round_id","project_member_id") WHERE (removed_at IS NULL);--> statement-breakpoint
CREATE INDEX "ro_round_active" ON "round_outliers" USING btree ("round_id") WHERE (removed_at IS NULL);