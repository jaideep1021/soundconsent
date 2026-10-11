import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import { HttpError } from "./errors.js";
import type { AuthState, ConsentDocument, DatabaseState, ReviewSession, StudySettings, FollowUp, DeliveryNotification } from "./types.js";

const EMPTY_STATE: DatabaseState = { schemaVersion: 1, documents: [], sessions: [] };

export class JsonStore {
  private state: DatabaseState = structuredClone(EMPTY_STATE);
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly file: string) {}

  async init(): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    try {
      const parsed: unknown = JSON.parse(await readFile(this.file, "utf8"));
      if (!isDatabaseState(parsed)) throw new Error("Unsupported or invalid state file");
      this.state = parsed;
    } catch (error) {
      if (isMissingFile(error)) return;
      throw new HttpError(500, `Could not load persistent state: ${error instanceof Error ? error.message : "invalid state"}`);
    }
  }

  getAuth(): AuthState {
    return structuredClone(this.state.auth ?? { accounts: [], grants: [], invitations: [] });
  }

  async updateAuth(change: (auth: AuthState) => void): Promise<void> {
    await this.mutate((state) => {
      state.auth ??= { accounts: [], grants: [], invitations: [] };
      change(state.auth);
    });
  }

  listDocuments(): ConsentDocument[] { return structuredClone(this.state.documents); }
  listSessions(): ReviewSession[] { return structuredClone(this.state.sessions); }

  getDocument(id: string): ConsentDocument | undefined {
    const found = this.state.documents.find((document) => document.id === id);
    return found ? structuredClone(found) : undefined;
  }

  getSession(id: string): ReviewSession | undefined {
    const found = this.state.sessions.find((session) => session.id === id);
    return found ? structuredClone(found) : undefined;
  }

  getElevenLabsAgentId(): string | undefined {
    return this.state.elevenLabsAgentId;
  }

  async saveElevenLabsAgentId(agentId: string): Promise<void> {
    await this.mutate((state) => { state.elevenLabsAgentId = agentId; });
  }

  getElevenLabsToolId(name: string): string | undefined {
    return this.state.elevenLabsToolIds?.[name];
  }

  async saveElevenLabsToolId(name: string, toolId: string): Promise<void> {
    await this.mutate((state) => {
      state.elevenLabsToolIds ??= {};
      state.elevenLabsToolIds[name] = toolId;
    });
  }

  async saveDocument(document: Omit<ConsentDocument, "id">): Promise<ConsentDocument> {
    const saved: ConsentDocument = { ...document, id: randomUUID() };
    await this.mutate((state) => state.documents.push(saved));
    return structuredClone(saved);
  }

  async saveSession(session: ReviewSession): Promise<void> {
    await this.mutate((state) => {
      const index = state.sessions.findIndex((current) => current.id === session.id);
      if (index < 0) state.sessions.push(session);
      else state.sessions[index] = session;
    });
  }

  async updateDocument(document: ConsentDocument, expected: number): Promise<void> {
    await this.mutate((state) => {
      const index = state.documents.findIndex((d) => d.id === document.id);
      if (index < 0) throw new HttpError(404, "Document not found");
      if ((state.documents[index]!.revision ?? 0) !== expected) throw new HttpError(409, "Document changed; refresh and retry");
      state.documents[index] = { ...document, revision: expected + 1 };
    });
  }

  settings(studyId: string): StudySettings {
    return structuredClone((this.state.settings && Object.hasOwn(this.state.settings, studyId) ? this.state.settings[studyId] : undefined) ?? { maxAttempts: 2, reminderDays: 7, notificationsEnabled: true, revision: 0 });
  }
  async saveSettings(studyId: string, settings: StudySettings): Promise<void> {
    await this.mutate((state) => {
      state.settings ??= {};
      if ((Object.hasOwn(state.settings, studyId) ? state.settings[studyId]!.revision : 0) !== settings.revision) throw new HttpError(409, "Settings changed; refresh and retry");
      Object.defineProperty(state.settings, studyId, { value: { ...settings, revision: settings.revision + 1 }, enumerable: true, writable: true, configurable: true });
    });
  }
  manualFlags(sessionId: string) { return structuredClone(this.state.manualFlags?.[sessionId] ?? []); }
  async addManualFlag(sessionId: string, description: string, createdBy: string) {
    await this.mutate((state) => {
      state.manualFlags ??= {};
      const flags = state.manualFlags[sessionId] ??= [];
      flags.push({ id: `manual:${randomUUID()}`, description, createdBy, createdAt: new Date().toISOString() });
    });
  }
  followUps(sessionId: string): FollowUp[] { return structuredClone(this.state.workflows?.[sessionId] ?? []); }
  async saveFollowUp(sessionId: string, followUp: FollowUp): Promise<void> {
    await this.mutate((state) => {
      state.workflows ??= {};
      const entries = state.workflows[sessionId] ??= [];
      const index = entries.findIndex((f) => f.flagId === followUp.flagId);
      if ((entries[index]?.revision ?? 0) !== followUp.revision) throw new HttpError(409, "Follow-up changed; refresh and retry");
      const saved = { ...followUp, revision: followUp.revision + 1 };
      if (index < 0) entries.push(saved); else entries[index] = saved;
    });
  }

  notifications(): DeliveryNotification[] { return structuredClone(this.state.notifications ?? []); }
  async enqueueNotification(notification: DeliveryNotification): Promise<void> {
    await this.mutate((state) => {
      state.notifications ??= [];
      if (!state.notifications.some((n) => n.id === notification.id)) state.notifications.push(notification);
    });
  }
  async updateNotification(id: string, change: (notification: DeliveryNotification) => void): Promise<void> {
    await this.mutate((state) => {
      const notification = state.notifications?.find((n) => n.id === id);
      if (!notification) throw new HttpError(404, "Notification not found");
      change(notification);
    });
  }

  private async mutate(change: (state: DatabaseState) => void): Promise<void> {
    const write = this.writeQueue.then(async () => {
      const next = structuredClone(this.state);
      change(next);
      const temporaryFile = `${this.file}.tmp`;
      await writeFile(temporaryFile, JSON.stringify(next), { mode: 0o600 });
      await rename(temporaryFile, this.file);
      this.state = next;
    });
    this.writeQueue = write.catch(() => {});
    await write;
  }
}

function isMissingFile(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function isDatabaseState(value: unknown): value is DatabaseState {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Partial<DatabaseState>;
  return state.schemaVersion === 1 &&
    Array.isArray(state.documents) &&
    Array.isArray(state.sessions) &&
    (state.auth === undefined || isAuthState(state.auth)) &&
    (state.elevenLabsAgentId === undefined || typeof state.elevenLabsAgentId === "string") &&
    (state.elevenLabsToolIds === undefined ||
      (typeof state.elevenLabsToolIds === "object" &&
        state.elevenLabsToolIds !== null &&
        !Array.isArray(state.elevenLabsToolIds) &&
        Object.values(state.elevenLabsToolIds).every((id) => typeof id === "string")));
}

function isAuthState(value: unknown): value is AuthState {
  if (!record(value) || !Array.isArray(value.accounts) || !Array.isArray(value.grants) || !Array.isArray(value.invitations)) return false;
  return (value.patients === undefined || (Array.isArray(value.patients) && value.patients.every((p: unknown) => record(p) && typeof p.id === "string" && typeof p.username === "string" && typeof p.passwordHash === "string"))) &&
    (value.memberships === undefined || (Array.isArray(value.memberships) && value.memberships.every((m: unknown) => record(m) && typeof m.patientId === "string" && typeof m.sessionId === "string" && typeof m.invitedAt === "string" && optionalString(m.openedAt)))) &&
    value.accounts.every((a: unknown) => record(a) && typeof a.id === "string" && typeof a.email === "string" && typeof a.name === "string" &&
    (a.role === "admin" || a.role === "coordinator") && typeof a.disabled === "boolean" && Array.isArray(a.studyIds) && a.studyIds.every((s: unknown) => typeof s === "string") && typeof a.passwordHash === "string") &&
    value.grants.every((g: unknown) => record(g) && typeof g.hash === "string" && ["coordinator", "patient", "voice", "patient_account"].includes(String(g.kind)) && typeof g.expiresAt === "number" && Number.isFinite(g.expiresAt) &&
      optionalString(g.patientId) && optionalString(g.accountId) && optionalString(g.sessionId) && optionalString(g.parentHash)) &&
    value.invitations.every((i: unknown) => record(i) && typeof i.hash === "string" && typeof i.codeHash === "string" && typeof i.sessionId === "string" && typeof i.expiresAt === "number" && Number.isFinite(i.expiresAt) && optionalString(i.accountId));
}
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function optionalString(value: unknown) { return value === undefined || typeof value === "string"; }
