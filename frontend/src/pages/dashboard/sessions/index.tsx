import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { backendApi } from "@/lib/backend-api";
import { SessionTable } from "@/components/dashboard/session-table";
import { QueryState } from "@/components/shared/query-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
export default function SessionsPage() {
  const query = useQuery({ queryKey: ["coordinator", "sessions"], queryFn: backendApi.sessions, refetchInterval: 15000 });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const filtered = query.data?.filter((s) => `${s.sessionId} ${s.documentTitle} ${s.studyId}`.toLowerCase().includes(search.trim().toLowerCase()) && (status === "All" || (status === "Needs follow-up" ? s.requiresFollowUp : s.status === status)));
  return <div className="space-y-8">
    <div className="flex justify-between gap-4 flex-wrap"><h1 className="text-4xl font-semibold">Sessions</h1><Button asChild><Link to="/dashboard/sessions/new">New Session</Link></Button></div>
    <div className="flex gap-3 flex-wrap"><Input className="max-w-md" aria-label="Search sessions" placeholder="Search studies, documents or session IDs…" value={search} onChange={(e) => setSearch(e.target.value)} /><select aria-label="Filter by status" className="h-11 border rounded-standard bg-cream px-3" value={status} onChange={(e) => setStatus(e.target.value)}><option>All</option><option value="in_progress">Active</option><option value="completed">Completed</option><option>Needs follow-up</option></select><Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>Refresh sessions</Button></div>
    <QueryState pending={query.isPending} error={query.error} retry={query.refetch} />
    {filtered && <SessionTable sessions={filtered} />}
  </div>;
}
