import { relations } from "drizzle-orm/relations";
import { profiles, projects, superAdmins, notifications, platformPermissionRequests, projectMembers, projectInvitations, onboardingResponses, onboardingQuestions, codebookVersions, codebookDefinitions, codebookCriteria, promptVersions, inputItems, rounds } from "./schema";

export const projectsRelations = relations(projects, ({one, many}) => ({
	profile: one(profiles, {
		fields: [projects.createdBy],
		references: [profiles.id]
	}),
	projectMembers: many(projectMembers),
	projectInvitations: many(projectInvitations),
	onboardingQuestions: many(onboardingQuestions),
	codebookVersions: many(codebookVersions),
	promptVersions: many(promptVersions),
	inputItems: many(inputItems),
	rounds: many(rounds),
}));

export const profilesRelations = relations(profiles, ({many}) => ({
	projects: many(projects),
	superAdmins_userId: many(superAdmins, {
		relationName: "superAdmins_userId_profiles_id"
	}),
	superAdmins_grantedBy: many(superAdmins, {
		relationName: "superAdmins_grantedBy_profiles_id"
	}),
	notifications: many(notifications),
	platformPermissionRequests_userId: many(platformPermissionRequests, {
		relationName: "platformPermissionRequests_userId_profiles_id"
	}),
	platformPermissionRequests_resolvedBy: many(platformPermissionRequests, {
		relationName: "platformPermissionRequests_resolvedBy_profiles_id"
	}),
	projectMembers: many(projectMembers),
	projectInvitations_inviteeId: many(projectInvitations, {
		relationName: "projectInvitations_inviteeId_profiles_id"
	}),
	projectInvitations_invitedBy: many(projectInvitations, {
		relationName: "projectInvitations_invitedBy_profiles_id"
	}),
	codebookVersions: many(codebookVersions),
	promptVersions: many(promptVersions),
	inputItems: many(inputItems),
	rounds: many(rounds),
}));

export const superAdminsRelations = relations(superAdmins, ({one}) => ({
	profile_userId: one(profiles, {
		fields: [superAdmins.userId],
		references: [profiles.id],
		relationName: "superAdmins_userId_profiles_id"
	}),
	profile_grantedBy: one(profiles, {
		fields: [superAdmins.grantedBy],
		references: [profiles.id],
		relationName: "superAdmins_grantedBy_profiles_id"
	}),
}));

export const notificationsRelations = relations(notifications, ({one}) => ({
	profile: one(profiles, {
		fields: [notifications.userId],
		references: [profiles.id]
	}),
}));

export const platformPermissionRequestsRelations = relations(platformPermissionRequests, ({one}) => ({
	profile_userId: one(profiles, {
		fields: [platformPermissionRequests.userId],
		references: [profiles.id],
		relationName: "platformPermissionRequests_userId_profiles_id"
	}),
	profile_resolvedBy: one(profiles, {
		fields: [platformPermissionRequests.resolvedBy],
		references: [profiles.id],
		relationName: "platformPermissionRequests_resolvedBy_profiles_id"
	}),
}));

export const projectMembersRelations = relations(projectMembers, ({one, many}) => ({
	project: one(projects, {
		fields: [projectMembers.projectId],
		references: [projects.id]
	}),
	profile: one(profiles, {
		fields: [projectMembers.userId],
		references: [profiles.id]
	}),
	onboardingResponses: many(onboardingResponses),
}));

export const projectInvitationsRelations = relations(projectInvitations, ({one}) => ({
	project: one(projects, {
		fields: [projectInvitations.projectId],
		references: [projects.id]
	}),
	profile_inviteeId: one(profiles, {
		fields: [projectInvitations.inviteeId],
		references: [profiles.id],
		relationName: "projectInvitations_inviteeId_profiles_id"
	}),
	profile_invitedBy: one(profiles, {
		fields: [projectInvitations.invitedBy],
		references: [profiles.id],
		relationName: "projectInvitations_invitedBy_profiles_id"
	}),
}));

export const onboardingResponsesRelations = relations(onboardingResponses, ({one}) => ({
	projectMember: one(projectMembers, {
		fields: [onboardingResponses.projectMemberId],
		references: [projectMembers.id]
	}),
	onboardingQuestion: one(onboardingQuestions, {
		fields: [onboardingResponses.questionId],
		references: [onboardingQuestions.id]
	}),
}));

export const onboardingQuestionsRelations = relations(onboardingQuestions, ({one, many}) => ({
	onboardingResponses: many(onboardingResponses),
	project: one(projects, {
		fields: [onboardingQuestions.projectId],
		references: [projects.id]
	}),
}));

export const codebookVersionsRelations = relations(codebookVersions, ({one, many}) => ({
	project: one(projects, {
		fields: [codebookVersions.projectId],
		references: [projects.id]
	}),
	profile: one(profiles, {
		fields: [codebookVersions.createdBy],
		references: [profiles.id]
	}),
	codebookDefinitions: many(codebookDefinitions),
	codebookCriteria: many(codebookCriteria),
	rounds: many(rounds),
}));

export const codebookDefinitionsRelations = relations(codebookDefinitions, ({one, many}) => ({
	codebookVersion: one(codebookVersions, {
		fields: [codebookDefinitions.codebookVersionId],
		references: [codebookVersions.id]
	}),
	codebookCriteria: many(codebookCriteria),
}));

export const codebookCriteriaRelations = relations(codebookCriteria, ({one}) => ({
	codebookVersion: one(codebookVersions, {
		fields: [codebookCriteria.codebookVersionId],
		references: [codebookVersions.id]
	}),
	codebookDefinition: one(codebookDefinitions, {
		fields: [codebookCriteria.definitionId],
		references: [codebookDefinitions.id]
	}),
}));

export const promptVersionsRelations = relations(promptVersions, ({one, many}) => ({
	project: one(projects, {
		fields: [promptVersions.projectId],
		references: [projects.id]
	}),
	profile: one(profiles, {
		fields: [promptVersions.createdBy],
		references: [profiles.id]
	}),
	rounds: many(rounds),
}));

export const inputItemsRelations = relations(inputItems, ({one}) => ({
	project: one(projects, {
		fields: [inputItems.projectId],
		references: [projects.id]
	}),
	profile: one(profiles, {
		fields: [inputItems.createdBy],
		references: [profiles.id]
	}),
}));

export const roundsRelations = relations(rounds, ({one}) => ({
	project: one(projects, {
		fields: [rounds.projectId],
		references: [projects.id]
	}),
	codebookVersion: one(codebookVersions, {
		fields: [rounds.codebookVersionId],
		references: [codebookVersions.id]
	}),
	promptVersion: one(promptVersions, {
		fields: [rounds.promptVersionId],
		references: [promptVersions.id]
	}),
	profile: one(profiles, {
		fields: [rounds.createdBy],
		references: [profiles.id]
	}),
}));
