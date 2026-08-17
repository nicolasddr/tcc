import { pgTable, index, foreignKey, check, uuid, text, timestamp, unique, boolean, jsonb, uniqueIndex, integer } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// FONTE DA VERDADE do schema (issue #22, Fase 4 — o flip). Depois de remover RLS/policies/
// triggers/RPCs, o Drizzle passou a ser DONO do schema: este arquivo é gerado/mantido à mão
// e `drizzle-kit generate` produz o baseline em supabase/migrations. Não há mais introspecção
// nem policies aqui — a autorização vive na app-layer (lib/authz, checagens nas actions).

export const projects = pgTable("projects", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	status: text().default('active').notNull(),
	createdBy: uuid("created_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	// updated_at gerido pela app via $onUpdate (o trigger set_updated_at saiu no flip da Fase 4).
	// Nota: o $onUpdate também popula a coluna no INSERT (sem .default), então um projeto novo
	// nasce com updated_at = now(). Inofensivo: nada no app lê projects.updated_at.
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).$onUpdate(() => sql`now()`),
	taskType: text("task_type"),
}, (table) => [
	index("projects_created_by_status").using("btree", table.createdBy.asc().nullsLast(), table.status.asc().nullsLast()),
	index("projects_status").using("btree", table.status.asc().nullsLast()),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [profiles.id],
			name: "projects_created_by_fkey"
		}).onDelete("restrict"),
	check("projects_status_check", sql`status = ANY (ARRAY['active'::text, 'completed'::text, 'archived'::text])`),
	check("projects_task_type_check", sql`task_type = ANY (ARRAY['classification'::text, 'quality_evaluation'::text, 'generation'::text, 'mixed'::text, 'other'::text])`),
	// Limites de tamanho (defesa em profundidade — ver lib/limits.ts, mesmos valores).
	// Números literais porque o drizzle-kit precisa deles congelados na migration gerada.
	check("projects_name_len", sql`char_length(name) <= 200`),
	check("projects_description_len", sql`description IS NULL OR char_length(description) <= 2000`),
]);

export const profiles = pgTable("profiles", {
	id: uuid().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	canCreateProjects: boolean("can_create_projects").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	// updated_at gerido pela app via $onUpdate (o grant de coluna e o trigger set_updated_at
	// saíram no flip da Fase 4; antes o $onUpdate esbarraria no grant que só liberava name).
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).$onUpdate(() => sql`now()`),
}, (table) => [
	unique("profiles_email_key").on(table.email),
	// Limite de tamanho (defesa em profundidade — ver lib/limits.ts, mesmo valor).
	check("profiles_name_len", sql`char_length(name) <= 200`),
]);

export const superAdmins = pgTable("super_admins", {
	userId: uuid("user_id").primaryKey().notNull(),
	grantedAt: timestamp("granted_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	grantedBy: uuid("granted_by"),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "super_admins_user_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.grantedBy],
			foreignColumns: [profiles.id],
			name: "super_admins_granted_by_fkey"
		}).onDelete("set null"),
]);

export const notifications = pgTable("notifications", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	type: text().notNull(),
	payload: jsonb().notNull(),
	readAt: timestamp("read_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("notifications_inbox").using("btree", table.userId.asc().nullsLast(), table.createdAt.desc().nullsFirst()),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "notifications_user_id_fkey"
		}).onDelete("cascade"),
	check("notifications_type_check", sql`type = ANY (ARRAY['project_invitation'::text, 'permission_decision'::text])`),
]);

export const platformPermissionRequests = pgTable("platform_permission_requests", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	status: text().default('pending').notNull(),
	resolvedBy: uuid("resolved_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	uniqueIndex("ppr_one_pending_per_user").using("btree", table.userId.asc().nullsLast()).where(sql`(status = 'pending'::text)`),
	index("ppr_status_created").using("btree", table.status.asc().nullsLast(), table.createdAt.asc().nullsLast()),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "platform_permission_requests_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.resolvedBy],
			foreignColumns: [profiles.id],
			name: "platform_permission_requests_resolved_by_fkey"
		}).onDelete("set null"),
	check("platform_permission_requests_status_check", sql`status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])`),
]);

export const projectMembers = pgTable("project_members", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	projectId: uuid("project_id").notNull(),
	userId: uuid("user_id").notNull(),
	role: text().notNull(),
	status: text().default('pending_onboarding').notNull(),
	evaluationsEnabled: boolean("evaluations_enabled").default(true).notNull(),
	joinedAt: timestamp("joined_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true, mode: 'string' }),
	consentAcceptedAt: timestamp("consent_accepted_at", { withTimezone: true, mode: 'string' }),
	consentTextSnapshot: text("consent_text_snapshot"),
	// updated_at gerido pela app via $onUpdate (o grant de coluna e o trigger set_updated_at
	// saíram no flip da Fase 4; antes o $onUpdate esbarraria no grant limitado a status/consent).
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).$onUpdate(() => sql`now()`),
}, (table) => [
	index("pm_project_status").using("btree", table.projectId.asc().nullsLast(), table.status.asc().nullsLast()),
	index("pm_user_status").using("btree", table.userId.asc().nullsLast(), table.status.asc().nullsLast()),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "project_members_project_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "project_members_user_id_fkey"
		}).onDelete("cascade"),
	unique("pm_unique_role").on(table.projectId, table.userId, table.role),
	check("project_members_role_check", sql`role = ANY (ARRAY['administrator'::text, 'evaluator'::text])`),
	check("project_members_status_check", sql`status = ANY (ARRAY['pending_onboarding'::text, 'active'::text, 'inactive'::text])`),
	check("pm_consent_required", sql`(status = 'pending_onboarding'::text) OR (role = 'administrator'::text) OR ((consent_accepted_at IS NOT NULL) AND (consent_text_snapshot IS NOT NULL))`),
	check("pm_onboarding_done", sql`(role = 'administrator'::text) OR (status = 'pending_onboarding'::text) OR (onboarding_completed_at IS NOT NULL)`),
]);

export const projectInvitations = pgTable("project_invitations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	projectId: uuid("project_id").notNull(),
	// NULLABLE desde 0009 (ADR 0006): convite por e-mail fica pendente sem perfil;
	// invitee_id é preenchido na resolução (1º login). Ver inviteeEmail.
	inviteeId: uuid("invitee_id"),
	inviteeEmail: text("invitee_email"),
	invitedBy: uuid("invited_by"),
	status: text().default('pending').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("inv_invitee_status").using("btree", table.inviteeId.asc().nullsLast(), table.status.asc().nullsLast()),
	uniqueIndex("inv_one_pending_per_invitee").using("btree", table.projectId.asc().nullsLast(), table.inviteeId.asc().nullsLast()).where(sql`(status = 'pending'::text)`),
	uniqueIndex("inv_one_pending_per_email").using("btree", table.projectId.asc().nullsLast(), sql`lower(invitee_email)`).where(sql`(status = 'pending'::text)`),
	index("inv_project_status").using("btree", table.projectId.asc().nullsLast(), table.status.asc().nullsLast()),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "project_invitations_project_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.inviteeId],
			foreignColumns: [profiles.id],
			name: "project_invitations_invitee_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.invitedBy],
			foreignColumns: [profiles.id],
			name: "project_invitations_invited_by_fkey"
		}).onDelete("set null"),
	check("project_invitations_status_check", sql`status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'cancelled'::text])`),
	check("inv_target_present", sql`(invitee_id IS NOT NULL) OR (invitee_email IS NOT NULL)`),
	// Limite de tamanho (defesa em profundidade — ver lib/limits.ts, mesmo valor).
	check("inv_invitee_email_len", sql`invitee_email IS NULL OR char_length(invitee_email) <= 254`),
]);

export const onboardingResponses = pgTable("onboarding_responses", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	projectMemberId: uuid("project_member_id").notNull(),
	questionId: uuid("question_id").notNull(),
	answer: text().notNull(),
	answeredAt: timestamp("answered_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("or_member").using("btree", table.projectMemberId.asc().nullsLast()),
	foreignKey({
			columns: [table.projectMemberId],
			foreignColumns: [projectMembers.id],
			name: "onboarding_responses_project_member_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.questionId],
			foreignColumns: [onboardingQuestions.id],
			name: "onboarding_responses_question_id_fkey"
		}).onDelete("cascade"),
	unique("or_unique_member_question").on(table.projectMemberId, table.questionId),
	// Limite de tamanho (defesa em profundidade — ver lib/limits.ts, mesmo valor).
	check("or_answer_len", sql`char_length(answer) <= 5000`),
]);

export const onboardingQuestions = pgTable("onboarding_questions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	projectId: uuid("project_id").notNull(),
	questionText: text("question_text").notNull(),
	questionType: text("question_type").notNull(),
	options: jsonb(),
	orderIndex: integer("order_index").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("oq_project_order").using("btree", table.projectId.asc().nullsLast(), table.orderIndex.asc().nullsLast()),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "onboarding_questions_project_id_fkey"
		}).onDelete("cascade"),
	check("onboarding_questions_question_type_check", sql`question_type = ANY (ARRAY['open'::text, 'multiple_choice'::text])`),
	// Limites de tamanho (defesa em profundidade — ver lib/limits.ts, mesmos valores).
	// `options` é jsonb (lista de strings); sem checar item a item no banco (isso já é
	// validado na action), só um teto pro blob inteiro contra abuso bruto de tamanho.
	check("oq_question_text_len", sql`char_length(question_text) <= 500`),
	check("oq_options_size", sql`options IS NULL OR pg_column_size(options) <= 8000`),
]);
