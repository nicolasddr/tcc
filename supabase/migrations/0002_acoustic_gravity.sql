ALTER TABLE "onboarding_questions" ADD CONSTRAINT "oq_question_text_len" CHECK (char_length(question_text) <= 500);--> statement-breakpoint
ALTER TABLE "onboarding_questions" ADD CONSTRAINT "oq_options_size" CHECK (options IS NULL OR pg_column_size(options) <= 8000);--> statement-breakpoint
ALTER TABLE "onboarding_responses" ADD CONSTRAINT "or_answer_len" CHECK (char_length(answer) <= 5000);--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_name_len" CHECK (char_length(name) <= 200);--> statement-breakpoint
ALTER TABLE "project_invitations" ADD CONSTRAINT "inv_invitee_email_len" CHECK (invitee_email IS NULL OR char_length(invitee_email) <= 254);--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_name_len" CHECK (char_length(name) <= 200);--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_description_len" CHECK (description IS NULL OR char_length(description) <= 2000);