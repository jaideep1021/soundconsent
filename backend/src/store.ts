import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import { HttpError } from "./errors.js";
import type { ConsentDocument, DatabaseState, ReviewSession } from "./types.js";

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

  getDocument(id: string): ConsentDocument | undefined {
    const found = this.state.documents.find((document) => document.id === id);
    return found ? structuredClone(found) : undefined;
  }

  getSession(id: string): ReviewSession | undefined {
    const found = this.state.sessions.find((session) => session.id === id);
    return found ? structuredClone(found) : undefined;
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

  private async mutate(change: (state: DatabaseState) => void): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      const next = structuredClone(this.state);
      change(next);
      const temporaryFile = `${this.file}.tmp`;
      await writeFile(temporaryFile, JSON.stringify(next), { mode: 0o600 });
      await rename(temporaryFile, this.file);
      this.state = next;
    });
    await this.writeQueue;
  }
}

function isMissingFile(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function isDatabaseState(value: unknown): value is DatabaseState {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Partial<DatabaseState>;
  return state.schemaVersion === 1 && Array.isArray(state.documents) && Array.isArray(state.sessions);
}
