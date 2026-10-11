import { useState } from "react";
import { Link } from "react-router";
import type { SessionData } from "@/types/session";
import { Badge } from "@/components/ui/badge";
import { sessionStatus } from "@/lib/session-status";
export function SessionTable({ sessions }: { sessions: SessionData[] }) {
  const [sort, setSort] = useState<"patientName" | "procedureName" | "status">(
    "patientName",
  );
  const [descending, setDescending] = useState(false);
  const sorted = [...sessions].sort(
    (a, b) =>
      (sort === "status"
        ? sessionStatus(a).localeCompare(sessionStatus(b))
        : a[sort].localeCompare(b[sort])) * (descending ? -1 : 1),
  );
  if (!sessions.length)
    return (
      <p role="status" className="border rounded-xl p-8 text-muted-foreground">
        No sessions to display.
      </p>
    );
  return (
    <div className="overflow-x-auto border rounded-xl">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">
          Patient sessions. Use column headings to sort.
        </caption>
        <thead>
          <tr>
            {(
              [
                ["patientName", "Patient Name"],
                ["procedureName", "Document"],
                ["status", "Status"],
              ] as const
            ).map(([key, label]) => (
              <th
                key={key}
                scope="col"
                aria-sort={
                  sort === key
                    ? descending
                      ? "descending"
                      : "ascending"
                    : "none"
                }
                className="p-4 border-b"
              >
                <button
                  className="min-h-11 text-left"
                  onClick={() => {
                    if (sort === key) setDescending(!descending);
                    else {
                      setSort(key);
                      setDescending(false);
                    }
                  }}
                >
                  {label}
                  {sort === key ? (descending ? " ↓" : " ↑") : ""}
                </button>
              </th>
            ))}
            <th scope="col" className="p-4 border-b">
              Progress
            </th>
            <th scope="col" className="p-4 border-b">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((session) => (
            <tr key={session.id} className="border-b last:border-0">
              <td className="p-4">{session.patientName}</td>
              <td className="p-4 text-muted-foreground">
                {session.procedureName}
              </td>
              <td className="p-4">
                <Badge variant={session.flagged ? "failed" : "secondary"}>
                  {sessionStatus(session)}
                </Badge>
              </td>
              <td className="p-4">
                {
                  session.sections.filter(
                    (s) =>
                      s.status === "completed" || s.status === "needs-review",
                  ).length
                }{" "}
                / {session.sections.length} reviewed
              </td>
              <td className="p-4">
                <Link
                  className="inline-flex min-h-11 items-center underline"
                  aria-label={`View session for ${session.patientName}`}
                  to={`/dashboard/sessions/${session.id}`}
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
