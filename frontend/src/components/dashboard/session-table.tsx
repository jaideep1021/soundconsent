import { useState } from "react";
import { Link } from "react-router";
import type { BackendSessionSummary } from "@/lib/backend-api";
import { Badge } from "@/components/ui/badge";
export function SessionTable({ sessions }: { sessions: BackendSessionSummary[] }) {
  const [sort, setSort] = useState<"startedAt" | "documentTitle" | "status">("startedAt");
  const [descending, setDescending] = useState(true);
  const sorted = [...sessions].sort((a, b) => a[sort].localeCompare(b[sort]) * (descending ? -1 : 1));
  if (!sessions.length) return <p role="status" className="border rounded-xl p-8 text-muted-foreground">No sessions to display.</p>;
  return <div className="overflow-x-auto border rounded-xl"><table className="w-full text-left text-sm">
    <caption className="sr-only">Study sessions. Use column headings to sort.</caption>
    <thead><tr>{([["startedAt", "Started"], ["documentTitle", "Document"], ["status", "Status"]] as const).map(([key, label]) => <th key={key} scope="col" className="p-4 border-b" aria-sort={sort === key ? descending ? "descending" : "ascending" : "none"}><button className="min-h-11 text-left" onClick={() => { if (sort === key) setDescending(!descending); else { setSort(key); setDescending(false); } }}>{label}{sort === key ? descending ? " ↓" : " ↑" : ""}</button></th>)}<th scope="col" className="p-4 border-b">Progress</th><th scope="col" className="p-4 border-b">Action</th></tr></thead>
    <tbody>{sorted.map((session) => <tr key={session.sessionId} className="border-b last:border-0">
      <td className="p-4 whitespace-nowrap">{new Date(session.startedAt).toLocaleDateString()}</td>
      <td className="p-4"><p>{session.documentTitle}</p><p className="text-muted-foreground">{session.studyId} · Version {session.documentVersion}</p></td>
      <td className="p-4"><Badge variant={session.requiresFollowUp ? "failed" : "secondary"}>{session.status === "completed" ? "Completed" : "Active"}</Badge>{session.requiresFollowUp && <p className="mt-2">Needs follow-up</p>}</td>
      <td className="p-4">{session.reviewedSections} / {session.totalSections} reviewed</td>
      <td className="p-4"><Link className="inline-flex min-h-11 items-center underline" aria-label={`View session ${session.sessionId}`} to={`/dashboard/sessions/${encodeURIComponent(session.sessionId)}`}>View</Link></td>
    </tr>)}</tbody>
  </table></div>;
}
