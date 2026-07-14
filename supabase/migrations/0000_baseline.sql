CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_type_check" CHECK (type = ANY (ARRAY['project_invitation'::text, 'permission_decision'::text]))
);
--> statement-breakpoint
CREATE TABLE "onboarding_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"question_text" text NOT NULL,
	"question_type" text NOT NULL,
	"options" jsonb,
	"order_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "onboarding_questions_question_type_check" CHECK (question_type = ANY (ARRAY['open'::text, 'multiple_choice'::text]))
);
--> statement-breakpoint
CREATE TABLE "onboarding_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_member_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"answer" text NOT NULL,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "or_unique_member_question" UNIQUE("project_member_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "platform_permission_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"resolved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "platform_permission_requests_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"can_create_projects" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "profiles_email_key" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "project_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"invitee_id" uuid,
	"invitee_email" text,
	"invited_by" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "project_invitations_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'cancelled'::text])),
	CONSTRAINT "inv_target_present" CHECK ((invitee_id IS NOT NULL) OR (invitee_email IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'pending_onboarding' NOT NULL,
	"evaluations_enabled" boolean DEFAULT true NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"onboarding_completed_at" timestamp with time zone,
	"consent_accepted_at" timestamp with time zone,
	"consent_text_snapshot" text,
	"updated_at" timestamp with time zone,
	CONSTRAINT "pm_unique_role" UNIQUE("project_id","user_id","role"),
	CONSTRAINT "project_members_role_check" CHECK (role = ANY (ARRAY['administrator'::text, 'evaluator'::text])),
	CONSTRAINT "project_members_status_check" CHECK (status = ANY (ARRAY['pending_onboarding'::text, 'active'::text, 'inactive'::text])),
	CONSTRAINT "pm_consent_required" CHECK ((status = 'pending_onboarding'::text) OR (role = 'administrator'::text) OR ((consent_accepted_at IS NOT NULL) AND (consent_text_snapshot IS NOT NULL))),
	CONSTRAINT "pm_onboarding_done" CHECK ((role = 'administrator'::text) OR (status = 'pending_onboarding'::text) OR (onboarding_completed_at IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"task_type" text,
	CONSTRAINT "projects_status_check" CHECK (status = ANY (ARRAY['active'::text, 'completed'::text, 'archived'::text])),
	CONSTRAINT "projects_task_type_check" CHECK (task_type = ANY (ARRAY['classification'::text, 'quality_evaluation'::text, 'generation'::text, 'mixed'::text, 'other'::text]))
);
--> statement-breakpoint
CREATE TABLE "super_admins" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"granted_by" uuid
);
--> statement-breakpoint
-- NOTA: o `drizzle-kit generate` emite aqui um `CREATE TABLE "auth"."users"` para o stub
-- externo de lib/db/schema.ts (que existe só para tipar a FK profiles.id -> auth.users.id).
-- Removido à mão: a tabela auth.users é gerida pelo Supabase Auth e já existe quando esta
-- migration roda. O FK profiles_id_fkey abaixo referencia essa tabela real.
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_questions" ADD CONSTRAINT "onboarding_questions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_responses" ADD CONSTRAINT "onboarding_responses_project_member_id_fkey" FOREIGN KEY ("project_member_id") REFERENCES "public"."project_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_responses" ADD CONSTRAINT "onboarding_responses_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."onboarding_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_permission_requests" ADD CONSTRAINT "platform_permission_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_permission_requests" ADD CONSTRAINT "platform_permission_requests_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invitations" ADD CONSTRAINT "project_invitations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invitations" ADD CONSTRAINT "project_invitations_invitee_id_fkey" FOREIGN KEY ("invitee_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invitations" ADD CONSTRAINT "project_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "super_admins" ADD CONSTRAINT "super_admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "super_admins" ADD CONSTRAINT "super_admins_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_inbox" ON "notifications" USING btree ("user_id","created_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "oq_project_order" ON "onboarding_questions" USING btree ("project_id","order_index");--> statement-breakpoint
CREATE INDEX "or_member" ON "onboarding_responses" USING btree ("project_member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ppr_one_pending_per_user" ON "platform_permission_requests" USING btree ("user_id") WHERE (status = 'pending'::text);--> statement-breakpoint
CREATE INDEX "ppr_status_created" ON "platform_permission_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "inv_invitee_status" ON "project_invitations" USING btree ("invitee_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "inv_one_pending_per_invitee" ON "project_invitations" USING btree ("project_id","invitee_id") WHERE (status = 'pending'::text);--> statement-breakpoint
CREATE UNIQUE INDEX "inv_one_pending_per_email" ON "project_invitations" USING btree ("project_id",lower(invitee_email)) WHERE (status = 'pending'::text);--> statement-breakpoint
CREATE INDEX "inv_project_status" ON "project_invitations" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "pm_project_status" ON "project_members" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "pm_user_status" ON "project_members" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "projects_created_by_status" ON "projects" USING btree ("created_by","status");--> statement-breakpoint
CREATE INDEX "projects_status" ON "projects" USING btree ("status");