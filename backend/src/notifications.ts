import { createHash } from "node:crypto";
import type { Config } from "./config.js";
import { HttpError } from "./errors.js";
import type { JsonStore } from "./store.js";
import type { AuditLog } from "./audit.js";
import type { WorkflowService } from "./workflows.js";
import type { ReviewSession } from "./types.js";

/** Single-process durable outbox. The receiver must deduplicate Idempotency-Key. */
export class NotificationService {
  private processing: Promise<void> | undefined;
  constructor(private readonly store: JsonStore, private readonly workflows: WorkflowService, private readonly audit: AuditLog, private readonly config: Config, private readonly send: typeof fetch = fetch) {}
  get enabled() { return this.config.notificationDeliveryEnabled === true && !!this.config.notificationWebhookUrl && (this.config.notificationWebhookSecret?.length ?? 0) >= 32; }
  async enqueue(session: ReviewSession, flagId: unknown, kind: "follow_up" | "reminder" = "follow_up") {
    if (!this.enabled) throw new HttpError(503, "External notification delivery is not configured and enabled");
    if (!this.store.settings(session.studyId).notificationsEnabled) throw new HttpError(409, "Notifications are disabled for this study");
    const flag = this.workflows.read(session).find((f) => f.flagId === flagId);
    if (!flag || flag.status === "resolved") throw new HttpError(409, "Choose an unresolved follow-up flag");
    const id = createHash("sha256").update(JSON.stringify([session.id, flag.id, flag.revision, kind, kind === "reminder" ? flag.dueAt : null])).digest("hex");
    const now = new Date().toISOString();
    await this.store.enqueueNotification({ id, sessionId: session.id, studyId: session.studyId, flagId: flag.id, kind, assigneeId: flag.assigneeId, createdAt: now, nextAttemptAt: now, status: "pending", attempts: 0 });
    return this.store.notifications().find((n) => n.id === id)!;
  }
  async close() { await this.processing; }
  async retry(id: string) {
    if (!this.enabled) throw new HttpError(503, "External notification delivery is not configured and enabled");
    await this.store.updateNotification(id, (n) => {
      if (n.status !== "failed") throw new HttpError(409, "Only failed notifications can be retried");
      n.status = "pending"; n.attempts = 0; n.nextAttemptAt = new Date().toISOString(); delete n.error;
    });
  }
  async tick(): Promise<void> {
    if (!this.enabled) return;
    if (this.processing) return this.processing;
    this.processing = this.process().finally(() => { this.processing = undefined; });
    return this.processing;
  }
  private async process() {
    for (const session of this.store.listSessions()) {
      if (!this.store.settings(session.studyId).notificationsEnabled) continue;
      for (const flag of this.workflows.read(session)) {
        if (flag.status !== "resolved" && flag.dueAt && Date.parse(flag.dueAt) <= Date.now()) await this.enqueue(session, flag.id, "reminder");
      }
    }
    // Bounded batch, sequential dispatch. The persisted ID survives crashes and retries.
    for (const notification of this.store.notifications().filter((n) => n.status === "pending" && Date.parse(n.nextAttemptAt) <= Date.now()).slice(0, 20)) {
      if (notification.attempts >= 5) { await this.store.updateNotification(notification.id, (n) => { n.status = "failed"; n.error = "Webhook retry limit reached"; }); continue; }
      const session = this.store.getSession(notification.sessionId);
      const flag = session && this.workflows.read(session).find((f) => f.id === notification.flagId);
      const assignee = notification.assigneeId ? this.store.getAuth().accounts.find((a) => a.id === notification.assigneeId && !a.disabled && (a.role === "admin" || a.studyIds.includes(notification.studyId))) : null;
      if (!flag || flag.status === "resolved" || (notification.kind === "reminder" && (!flag.dueAt || Date.parse(flag.dueAt) > Date.now())) || flag.assigneeId !== notification.assigneeId || !this.store.settings(notification.studyId).notificationsEnabled || (notification.assigneeId && !assignee)) {
        await this.store.updateNotification(notification.id, (n) => { n.status = "cancelled"; }); continue;
      }
      const attempts = notification.attempts + 1;
      // Persist the attempt first so repeated process restarts cannot bypass retry limits.
      await this.store.updateNotification(notification.id, (n) => {
        n.attempts = attempts;
        n.nextAttemptAt = new Date(Date.now() + Math.min(3600000, 60000 * 2 ** (attempts - 1))).toISOString();
      });
      let delivered = false;
      try {
        const response = await this.send(this.config.notificationWebhookUrl!, {
          method: "POST", redirect: "error", signal: AbortSignal.timeout(10000),
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.config.notificationWebhookSecret}`, "Idempotency-Key": notification.id },
          body: JSON.stringify({ notificationId: notification.id, event: notification.kind, studyId: notification.studyId, sessionId: notification.sessionId, flagId: notification.flagId, assigneeId: notification.assigneeId, dueAt: flag.dueAt }),
        });
        delivered = response.ok;
        await response.body?.cancel();
      } catch { /* Persist a sanitized error, never provider details or credentials. */ }
      await this.store.updateNotification(notification.id, (n) => {
        if (delivered) { n.status = "delivered"; n.deliveredAt = new Date().toISOString(); delete n.error; }
        else { n.status = attempts >= 5 ? "failed" : "pending"; n.error = "Webhook delivery failed"; }
      });
      await this.audit.append(delivered ? "notification.delivered" : "notification.delivery_failed", { notificationId: notification.id, attempts }, notification.sessionId);
    }
  }
}
