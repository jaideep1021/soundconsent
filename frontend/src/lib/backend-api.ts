import { z } from "zod";
import axios from "axios";
import { apiClient } from "./api-client";

const progress = z.object({ index: z.number().int(), total: z.number().int(), title: z.string().nullable() });
const status = z.enum(["in_progress", "completed"]);
export const turnSchema = z.object({
  sessionId: z.string(), status, message: z.string(), section: progress,
  revision: z.number().int().optional(),
  requiresClinician: z.boolean().optional(), emergency: z.boolean().optional(),
});
export const documentSchema = z.object({
  id: z.string(), studyId: z.string(), version: z.string(), title: z.string(),
  lifecycle: z.enum(["draft", "published", "archived"]).default("published"), revision: z.number().default(0), parentId: z.string().optional(),
  pageCount: z.number(), sections: z.array(z.object({ id: z.string(), title: z.string(), text: z.string().optional() })),
});
const answerSchema = z.object({
  sessionId: z.string(), answer: z.string(), citations: z.array(z.string()),
  requiresClinician: z.boolean(), emergency: z.boolean().optional(),
});
const acknowledgmentSchema = z.object({ text: z.string(), acknowledgedAt: z.string(), actor: z.enum(["patient", "coordinator"]), documentVersion: z.string() });
export const reportSchema = z.object({
  sessionId: z.string(), studyId: z.string(), documentVersion: z.string(),
  startedAt: z.string(), completedAt: z.string().nullable(), status,
  sections: z.array(z.object({
    title: z.string(), outcome: z.enum(["passed", "needs_human_follow_up"]),
    attempts: z.number(), response: z.string(),
  })),
  outOfScopeQuestions: z.array(z.object({ question: z.string(), askedAt: z.string() })),
  acknowledgment: acknowledgmentSchema.nullable(),
  manualFlags: z.array(z.object({ id: z.string(), description: z.string(), createdAt: z.string(), createdBy: z.string() })),
  followUps: z.array(z.object({ flagId: z.string(), status: z.string(), assigneeId: z.string().nullable(), dueAt: z.string().nullable(), revision: z.number(), history: z.array(z.object({ at: z.string(), accountId: z.string(), status: z.string(), note: z.string(), assigneeId: z.string().nullable(), dueAt: z.string().nullable() })) })),
  humanHandoffRequired: z.literal(true), consentObtained: z.literal(false),
});
const userSchema = z.object({ id: z.string(), email: z.string(), name: z.string(), role: z.enum(["admin", "coordinator"]), studyIds: z.array(z.string()), disabled: z.boolean() });
export type BackendUser = z.infer<typeof userSchema>;

const settingsSchema = z.object({ maxAttempts: z.number(), reminderDays: z.number(), notificationsEnabled: z.boolean(), revision: z.number() });
export type StudySettings = z.infer<typeof settingsSchema>;
const flagSchema = z.object({ id: z.string(), flagId: z.string(), description: z.string(), status: z.enum(["open", "acknowledged", "resolved"]), assigneeId: z.string().nullable(), dueAt: z.string().nullable(), revision: z.number(), history: z.array(z.object({ at: z.string(), accountId: z.string(), status: z.string(), note: z.string(), assigneeId: z.string().nullable(), dueAt: z.string().nullable() })) });
export type FollowUpFlag = z.infer<typeof flagSchema>;
const snapshotSchema = turnSchema.extend({
  accessRole: z.enum(["patient", "coordinator"]),
  results: z.array(z.object({ sectionId: z.string(), sectionTitle: z.string(), passed: z.boolean(), attempts: z.number(), response: z.string() })),
  outOfScopeQuestions: z.array(z.object({ question: z.string(), askedAt: z.string() })),
  revision: z.number(), maxAttempts: z.number(), acknowledgment: acknowledgmentSchema.nullable(),
  documentId: z.string(), documentTitle: z.string(), studyId: z.string(), documentVersion: z.string(),
  disclosure: z.string(), attemptsForCurrentSection: z.number(), historyAvailable: z.boolean(),
  guide: z.object({ summary: z.string(), question: z.string() }).nullable(),
  transcript: z.array(z.object({ id: z.string(), role: z.enum(["ai", "patient"]), content: z.string(), timestamp: z.string(), sectionId: z.string().optional(), citations: z.array(z.string()).optional() })),
  sections: z.array(z.object({ id: z.string(), title: z.string(), text: z.string(), status: z.enum(["pending", "active", "completed", "needs-review"]) })),
});
export type BackendSnapshot = z.infer<typeof snapshotSchema>;
const summarySchema = z.object({ sessionId: z.string(), documentId: z.string(), documentTitle: z.string(), studyId: z.string(), documentVersion: z.string(), startedAt: z.string(), updatedAt: z.string(), status, reviewedSections: z.number(), totalSections: z.number(), requiresFollowUp: z.boolean() });
export type BackendSessionSummary = z.infer<typeof summarySchema>;

export type BackendTurn = z.infer<typeof turnSchema>;
export type BackendDocument = z.infer<typeof documentSchema>;
export type BackendReport = z.infer<typeof reportSchema>;
export type Mutation = { key: string; revision?: number };
export const newMutation = (revision?: number): Mutation => ({ key: crypto.randomUUID(), revision });
const mutationConfig = (mutation: Mutation) => ({ headers: { "Idempotency-Key": mutation.key, ...(mutation.revision === undefined ? {} : { "If-Match": String(mutation.revision) }) } });
const sessionPath = (id: string) => `/sessions/${encodeURIComponent(id)}`;

export const backendApi = {
  async login(email: string, password: string) { return z.object({ user: userSchema }).parse((await apiClient.post("/auth/login", { email, password })).data).user; },
  async me() { return z.object({ user: userSchema }).parse((await apiClient.get("/auth/me")).data).user; },
  async accounts() { return z.object({ accounts: z.array(userSchema) }).parse((await apiClient.get("/auth/accounts")).data).accounts; },
  async createAccount(account: { name: string; email: string; password: string; role: "admin" | "coordinator"; studyIds: string[] }) { return z.object({ user: userSchema }).parse((await apiClient.post("/auth/accounts", account)).data).user; },
  async disableAccount(id: string) { await apiClient.post(`/auth/accounts/${encodeURIComponent(id)}/disable`); },
  async logout() { await apiClient.post("/auth/logout"); },
  async documents() { return z.object({ documents: z.array(documentSchema) }).parse((await apiClient.get("/documents")).data).documents; },
  async document(id: string) { return documentSchema.parse((await apiClient.get(`/documents/${encodeURIComponent(id)}`)).data); },
  async sessions() { return z.object({ sessions: z.array(summarySchema) }).parse((await apiClient.get("/sessions")).data).sessions; },
  async session(id: string) { return snapshotSchema.parse((await apiClient.get(sessionPath(id))).data); },
  async invite(id: string) {
    return z.object({ sessionId: z.string(), invitationToken: z.string(), accessCode: z.string(), expiresAt: z.string() }).parse((await apiClient.post(`${sessionPath(id)}/invitations`)).data);
  },
  async exchange(id: string, invitationToken: string, accessCode: string) { await apiClient.post(`${sessionPath(id)}/access`, { invitationToken, accessCode }); },
  async revoke(id: string) { await apiClient.post(`${sessionPath(id)}/access/revoke`); },
  async patientLogout(id: string) { await apiClient.post(`${sessionPath(id)}/logout`); },
  async health() {
    return z.object({ status: z.literal("ok") }).parse((await apiClient.get("/health")).data);
  },
  async upload(file: File, studyId: string, version: string) {
    const form = new FormData();
    form.append("studyId", studyId.trim());
    if (version.trim()) form.append("version", version.trim());
    form.append("file", file);
    return documentSchema.parse((await apiClient.post("/documents", form)).data);
  },
  async start(documentId: string, mutation = newMutation()) {
    return turnSchema.parse((await apiClient.post("/sessions", { documentId: documentId.trim() }, mutationConfig(mutation))).data);
  },
  async respond(id: string, response: string, mutation = newMutation()) {
    return turnSchema.parse((await apiClient.post(`${sessionPath(id)}/responses`, { response }, mutationConfig(mutation))).data);
  },
  async ask(id: string, question: string, mutation = newMutation()) {
    return answerSchema.parse((await apiClient.post(`${sessionPath(id)}/questions`, { question }, mutationConfig(mutation))).data);
  },
  async audio(id: string, file: File, mutation = newMutation()) {
    const form = new FormData();
    form.append("file", file);
    return turnSchema.parse((await apiClient.post(`${sessionPath(id)}/audio`, form, mutationConfig(mutation))).data);
  },
  async speech(id: string): Promise<Blob> {
    try {
      return (await apiClient.post(`${sessionPath(id)}/speech`, undefined, { responseType: "blob" })).data;
    } catch (error) {
      // Axios also decodes JSON error bodies as Blobs for this request.
      if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
        try { error.response.data = JSON.parse(await error.response.data.text()); } catch { /* Preserve the HTTP error. */ }
      }
      throw error;
    }
  },
  async report(id: string) {
    return reportSchema.parse((await apiClient.get(`${sessionPath(id)}/report`)).data);
  },
  async conversation(id: string) {
    return z.object({ signedUrl: z.string().url(), dynamicVariables: z.record(z.string()) })
      .parse((await apiClient.get(`${sessionPath(id)}/conversation-url`)).data);
  },
  async acknowledge(id: string, mutation: Mutation) { await apiClient.post(`${sessionPath(id)}/acknowledgment`, { accepted: true }, mutationConfig(mutation)); },
  async draft(id: string, version: string) { return documentSchema.parse((await apiClient.post(`/documents/${id}/draft`, { version })).data); },
  async editDocument(document: BackendDocument) { return documentSchema.parse((await apiClient.post(`/documents/${document.id}/edit`, { title: document.title, sections: document.sections, revision: document.revision })).data); },
  async documentAction(document: BackendDocument, action: "publish" | "archive") { return documentSchema.parse((await apiClient.post(`/documents/${document.id}/${action}`, { revision: document.revision })).data); },
  async followUps(id: string) { return z.object({ flags: z.array(flagSchema), assignees: z.array(z.object({ id: z.string(), name: z.string() })) }).parse((await apiClient.get(`${sessionPath(id)}/follow-ups`)).data); },
  async addFollowUp(id: string, description: string) { await apiClient.post(`${sessionPath(id)}/flags`, { description }); },
  async updateFollowUp(id: string, flag: FollowUpFlag, note: string) { await apiClient.post(`${sessionPath(id)}/follow-ups`, { ...flag, note }); },
  async deliveries() { return z.object({ enabled: z.boolean(), deliveries: z.array(z.object({ id: z.string(), sessionId: z.string(), flagId: z.string(), kind: z.string(), status: z.enum(["pending", "delivered", "failed", "cancelled"]), attempts: z.number(), createdAt: z.string(), error: z.string().optional() })) }).parse((await apiClient.get("/notifications/delivery")).data); },
  async queueNotification(id: string, flagId: string) { return z.object({ status: z.enum(["pending", "delivered", "failed", "cancelled"]) }).parse((await apiClient.post(`${sessionPath(id)}/notifications`, { flagId })).data).status; },
  async retryNotification(id: string) { await apiClient.post(`/notifications/${id}/retry`); },
  async notifications() { return z.object({ notifications: z.array(z.object({ id: z.string(), sessionId: z.string(), studyId: z.string(), description: z.string(), status: z.string(), dueAt: z.string().nullable(), overdue: z.boolean() })) }).parse((await apiClient.get("/notifications")).data).notifications; },
  async settings(studyId: string) { return settingsSchema.parse((await apiClient.get(`/studies/${encodeURIComponent(studyId)}/settings`)).data); },
  async saveSettings(studyId: string, settings: StudySettings) { return settingsSchema.parse((await apiClient.post(`/studies/${encodeURIComponent(studyId)}/settings`, settings)).data); },
  async provision() {
    await apiClient.post("/agents/provision", undefined);
  },
};
