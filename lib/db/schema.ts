import { pgTable, pgSchema, index, foreignKey, pgPolicy, check, uuid, text, timestamp, unique, boolean, jsonb, uniqueIndex, integer } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// auth.users pertence ao schema `auth` do Supabase, fora do schemaFilter ['public'].
// O drizzle-kit referencia essa FK mas NÃO gera a tabela externa, deixando uma
// referência solta (em schema.ts ele escreve `users`, e em relations.ts `usersInAuth`).
// O app NUNCA consulta auth.users via Drizzle: este stub mínimo existe só para tipar a
// FK profiles.id -> auth.users.id. A fonte da verdade da tabela é o Supabase Auth.
const authSchema = pgSchema("auth")
export const usersInAuth = authSchema.table("users", {
	id: uuid().primaryKey().notNull(),
})



export const projects = pgTable("projects", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	status: text().default('active').notNull(),
	createdBy: uuid("created_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	// updated_at gerido pela app via $onUpdate (issue #22, Fase 2). projects tem grant de
	// UPDATE e de INSERT em todas as colunas ao papel `authenticated` (0003), então emitir
	// `updated_at = now()` daqui não esbarra em grant. O trigger projects_set_updated_at
	// segue no banco como backstop até o flip (Fase 4), sobrescrevendo com o mesmo now().
	// Nota: no Drizzle o $onUpdate também popula a coluna no INSERT (sem .default), então um
	// projeto novo passa a nascer com updated_at = now() (antes nascia nulo — o trigger só
	// dispara em UPDATE). Inofensivo: nada no app lê projects.updated_at; equivale a created_at.
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).$onUpdate(() => sql`now()`),
	taskType: text("task_type"),
}, (table) => [
	index("projects_created_by_status").using("btree", table.createdBy.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")),
	index("projects_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [profiles.id],
			name: "projects_created_by_fkey"
		}).onDelete("restrict"),
	pgPolicy("projects_insert", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`((created_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND p.can_create_projects))))`  }),
	pgPolicy("projects_update", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("projects_select", { as: "permissive", for: "select", to: ["public"] }),
	check("projects_status_check", sql`status = ANY (ARRAY['active'::text, 'completed'::text, 'archived'::text])`),
	check("projects_task_type_check", sql`task_type = ANY (ARRAY['classification'::text, 'quality_evaluation'::text, 'generation'::text, 'mixed'::text, 'other'::text])`),
]);

export const profiles = pgTable("profiles", {
	id: uuid().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	canCreateProjects: boolean("can_create_projects").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	// updated_at fica no trigger profiles_set_updated_at até o flip (Fase 4). O grant de
	// coluna da 0002 só libera UPDATE(name) ao papel `authenticated`, então emitir
	// `updated_at = now()` daqui via $onUpdate daria 42501 enquanto a RLS/grants estão on.
	// Ao remover os grants no flip, adicionar `.$onUpdate(() => sql\`now()\`)` aqui.
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.id],
			foreignColumns: [usersInAuth.id],
			name: "profiles_id_fkey"
		}).onDelete("cascade"),
	unique("profiles_email_key").on(table.email),
	pgPolicy("profiles_select_own", { as: "permissive", for: "select", to: ["public"], using: sql`(id = auth.uid())` }),
	pgPolicy("profiles_update_own", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("profiles_select_shared_members", { as: "permissive", for: "select", to: ["public"] }),
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
	pgPolicy("super_admins_select_own", { as: "permissive", for: "select", to: ["public"], using: sql`(user_id = auth.uid())` }),
]);

export const notifications = pgTable("notifications", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	type: text().notNull(),
	payload: jsonb().notNull(),
	readAt: timestamp("read_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("notifications_inbox").using("btree", table.userId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "notifications_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("notifications_select_own", { as: "permissive", for: "select", to: ["public"], using: sql`(user_id = auth.uid())` }),
	pgPolicy("notifications_update_own", { as: "permissive", for: "update", to: ["public"] }),
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
	uniqueIndex("ppr_one_pending_per_user").using("btree", table.userId.asc().nullsLast().op("uuid_ops")).where(sql`(status = 'pending'::text)`),
	index("ppr_status_created").using("btree", table.status.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("text_ops")),
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
	pgPolicy("ppr_select", { as: "permissive", for: "select", to: ["public"], using: sql`((user_id = auth.uid()) OR is_super_admin())` }),
	pgPolicy("ppr_insert_own", { as: "permissive", for: "insert", to: ["public"] }),
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
	// updated_at fica no trigger project_members_set_updated_at até o flip (Fase 4). O grant
	// de coluna da 0002 só libera UPDATE(status, consent_accepted_at, consent_text_snapshot,
	// onboarding_completed_at) ao papel `authenticated`, então emitir `updated_at = now()`
	// daqui via $onUpdate daria 42501 enquanto a RLS/grants estão on (ver removeMember/
	// leaveProject). Ao remover os grants no flip, adicionar `.$onUpdate(() => sql\`now()\`)`.
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("pm_project_status").using("btree", table.projectId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("text_ops")),
	index("pm_user_status").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("uuid_ops")),
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
	pgPolicy("pm_select", { as: "permissive", for: "select", to: ["public"], using: sql`((user_id = auth.uid()) OR is_project_admin(project_id) OR (is_member_of(project_id) AND (status <> 'pending_onboarding'::text)))` }),
	pgPolicy("pm_insert", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("pm_update", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("pm_delete_own_pending", { as: "permissive", for: "delete", to: ["public"], using: sql`((user_id = auth.uid()) AND (status = 'pending_onboarding'::text))` }),
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
	index("inv_invitee_status").using("btree", table.inviteeId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("inv_one_pending_per_invitee").using("btree", table.projectId.asc().nullsLast().op("uuid_ops"), table.inviteeId.asc().nullsLast().op("uuid_ops")).where(sql`(status = 'pending'::text)`),
	uniqueIndex("inv_one_pending_per_email").using("btree", table.projectId.asc().nullsLast().op("uuid_ops"), sql`lower(invitee_email)`).where(sql`(status = 'pending'::text)`),
	index("inv_project_status").using("btree", table.projectId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("uuid_ops")),
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
	pgPolicy("inv_select", { as: "permissive", for: "select", to: ["public"], using: sql`((invitee_id = auth.uid()) OR is_project_admin(project_id))` }),
	pgPolicy("inv_insert", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("inv_update", { as: "permissive", for: "update", to: ["public"] }),
	check("project_invitations_status_check", sql`status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'cancelled'::text])`),
	check("inv_target_present", sql`(invitee_id IS NOT NULL) OR (invitee_email IS NOT NULL)`),
]);

export const onboardingResponses = pgTable("onboarding_responses", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	projectMemberId: uuid("project_member_id").notNull(),
	questionId: uuid("question_id").notNull(),
	answer: text().notNull(),
	answeredAt: timestamp("answered_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("or_member").using("btree", table.projectMemberId.asc().nullsLast().op("uuid_ops")),
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
	pgPolicy("or_select", { as: "permissive", for: "select", to: ["public"], using: sql`can_view_response(project_member_id)` }),
	pgPolicy("or_insert", { as: "permissive", for: "insert", to: ["public"] }),
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
	index("oq_project_order").using("btree", table.projectId.asc().nullsLast().op("int4_ops"), table.orderIndex.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "onboarding_questions_project_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("oq_select", { as: "permissive", for: "select", to: ["public"], using: sql`is_project_member(project_id)` }),
	pgPolicy("oq_insert", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("oq_update", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("oq_delete", { as: "permissive", for: "delete", to: ["public"] }),
	check("onboarding_questions_question_type_check", sql`question_type = ANY (ARRAY['open'::text, 'multiple_choice'::text])`),
]);
