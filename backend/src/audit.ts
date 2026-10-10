import { createHash } from "node:crypto";
import { mkdir, readFile, appendFile } from "node:fs/promises";
import { dirname } from "node:path";
import { redactPii } from "./privacy.js";

interface AuditEvent {
  timestamp: string;
  event: string;
  sessionId?: string;
  details: Record<string, unknown>;
  previousHash: string;
  hash: string;
}

export class AuditLog {
  private previousHash = "GENESIS";
  private queue: Promise<void> = Promise.resolve();
  constructor(private readonly file: string) {}

  async init(): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    try {
      const content = await readFile(this.file, "utf8");
      const lines = content.trimEnd().split("\n").filter(Boolean);
      if (lines.length) {
        let expectedPrevious = "GENESIS";
        for (const line of lines) {
          const event: unknown = JSON.parse(line);
          if (!isAuditEvent(event) || event.previousHash !== expectedPrevious || hashEvent(event) !== event.hash) {
            throw new Error("audit chain integrity check failed");
          }
          expectedPrevious = event.hash;
        }
        this.previousHash = expectedPrevious;
      }
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return;
      throw new Error(`Could not verify audit log: ${error instanceof Error ? error.message : "invalid audit log"}`);
    }
  }

  append(event: string, details: Record<string, unknown>, sessionId?: string): Promise<void> {
    this.queue = this.queue.then(async () => {
      const redactedDetails = JSON.parse(redactPii(JSON.stringify(details))) as Record<string, unknown>;
      const base = {
        timestamp: new Date().toISOString(),
        event,
        ...(sessionId ? { sessionId } : {}),
        details: redactedDetails,
        previousHash: this.previousHash,
      };
      const hash = createHash("sha256").update(JSON.stringify(base)).digest("hex");
      const record: AuditEvent = { ...base, hash };
      await appendFile(this.file, `${JSON.stringify(record)}\n`, { mode: 0o600 });
      this.previousHash = hash;
    });
    return this.queue;
  }
}

function hashEvent(event: AuditEvent): string {
  const { hash: _hash, ...base } = event;
  return createHash("sha256").update(JSON.stringify(base)).digest("hex");
}

function isAuditEvent(value: unknown): value is AuditEvent {
  if (typeof value !== "object" || value === null) return false;
  const event = value as Partial<AuditEvent>;
  return typeof event.timestamp === "string" && typeof event.event === "string" &&
    typeof event.details === "object" && event.details !== null &&
    typeof event.previousHash === "string" && typeof event.hash === "string";
}
