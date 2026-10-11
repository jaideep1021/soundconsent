import { HttpError } from "./errors.js";
import { redactPii } from "./privacy.js";
import type { JsonStore } from "./store.js";
import type { AuditLog } from "./audit.js";
import type { FollowUp, ReviewSession, StudySettings } from "./types.js";

export function flagsFor(session: ReviewSession) {
  return [
    ...session.results.filter((r) => !r.passed).map((r) => ({ id: `section:${r.sectionId}`, description: `Review ${r.sectionTitle} with the participant`, createdAt: r.finalizedAt ?? session.completedAt ?? session.startedAt })),
    ...session.outOfScopeQuestions.map((q, i) => ({ id: `question:${i}`, description: q.question, createdAt: q.askedAt })),
  ];
}
export class WorkflowService {
  constructor(private readonly store: JsonStore, private readonly audit: AuditLog) {}
  read(session: ReviewSession) {
    const saved = this.store.followUps(session.id);
    const days = session.followUpDays ?? 7;
    return [...flagsFor(session), ...this.store.manualFlags(session.id)].map((flag) => ({ ...flag, ...(saved.find((f) => f.flagId === flag.id) ?? {
      flagId: flag.id, status: "open", assigneeId: null,
      dueAt: new Date(Date.parse(flag.createdAt) + days * 86400000).toISOString(), revision: 0, history: [],
    }) }));
  }
  async add(session: ReviewSession, description: unknown, accountId: string) {
    if (typeof description !== "string" || !description.trim() || description.length > 2000) throw new HttpError(400, "Provide a follow-up description of 1–2000 characters");
    await this.store.addManualFlag(session.id, redactPii(description.trim()), accountId);
    await this.audit.append("followup.created", { description: redactPii(description.trim()), accountId }, session.id);
    return this.read(session);
  }
  async update(session: ReviewSession, accountId: string, input: Record<string, unknown>) {
    const flag = this.read(session).find((f) => f.flagId === input.flagId);
    if (!flag) throw new HttpError(404, "Follow-up flag not found");
    if (!["open", "acknowledged", "resolved"].includes(String(input.status))) throw new HttpError(400, "Invalid follow-up status");
    if (!Number.isInteger(input.revision) || input.revision !== flag.revision) throw new HttpError(409, "Follow-up changed; refresh and retry");
    if (typeof input.note !== "string" || input.note.trim().length > 2000 || (input.status === "resolved" && !input.note.trim())) throw new HttpError(400, "A resolution note is required; maximum 2000 characters");
    if (input.assigneeId !== null && typeof input.assigneeId !== "string") throw new HttpError(400, "Invalid assignee");
    if (input.assigneeId) {
      const account = this.store.getAuth().accounts.find((a) => a.id === input.assigneeId && !a.disabled);
      if (!account || (account.role !== "admin" && !account.studyIds.includes(session.studyId))) throw new HttpError(400, "Assignee must have access to this study");
    }
    if (input.dueAt !== null && (typeof input.dueAt !== "string" || !Number.isFinite(Date.parse(input.dueAt)))) throw new HttpError(400, "Invalid due date");
    const followUp: FollowUp = {
      flagId: flag.flagId, status: input.status as FollowUp["status"], assigneeId: input.assigneeId as string | null,
      dueAt: input.dueAt as string | null, revision: flag.revision, history: [...flag.history],
    };
    const event = { at: new Date().toISOString(), accountId, status: followUp.status, note: redactPii(input.note.trim()), assigneeId: followUp.assigneeId, dueAt: followUp.dueAt };
    followUp.history.push(event);
    await this.store.saveFollowUp(session.id, followUp);
    await this.audit.append("followup.updated", { flagId: flag.flagId, ...event }, session.id);
    return this.read(session);
  }
  async settings(studyId: string, input: Record<string, unknown>, accountId: string) {
    if (!Number.isInteger(input.maxAttempts) || Number(input.maxAttempts) < 1 || Number(input.maxAttempts) > 3 ||
        !Number.isInteger(input.reminderDays) || Number(input.reminderDays) < 1 || Number(input.reminderDays) > 30 ||
        typeof input.notificationsEnabled !== "boolean" || !Number.isInteger(input.revision)) throw new HttpError(400, "Invalid study settings");
    const settings: StudySettings = { maxAttempts: Number(input.maxAttempts), reminderDays: Number(input.reminderDays), notificationsEnabled: input.notificationsEnabled, revision: Number(input.revision) };
    await this.store.saveSettings(studyId, settings);
    await this.audit.append("settings.updated", { studyId, accountId, ...settings });
    return this.store.settings(studyId);
  }
}
