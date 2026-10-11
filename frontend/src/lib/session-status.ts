import type { SessionData } from "@/types/session";
export function sessionStatus(session: SessionData) {
  return session.flagged
    ? "Needs Review"
    : session.status === "completed"
      ? "Completed"
      : session.status === "in-progress"
        ? "Active"
        : "Pending";
}
