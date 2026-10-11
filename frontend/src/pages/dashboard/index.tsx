import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { backendApi } from "@/lib/backend-api";
import { SessionTable } from "@/components/dashboard/session-table";
import { DocumentUploadModal } from "@/components/dashboard/document-upload";
import { QueryState } from "@/components/shared/query-state";
import { Button } from "@/components/ui/button";
export default function DashboardHome() {
  const query = useQuery({ queryKey: ["coordinator", "overview"], queryFn: async () => {
    const [sessions, documents, notifications] = await Promise.all([backendApi.sessions(), backendApi.documents(), backendApi.notifications()]);
    return { sessions, documents, notifications };
  }, refetchInterval: 15000 });
  return <div className="space-y-10">
    <div className="flex flex-wrap justify-between gap-4"><div><h1 className="text-4xl font-semibold">Overview</h1><p className="text-muted-foreground mt-2">Your study documents, understanding reviews and clinical follow-ups.</p></div><div className="flex gap-3 flex-wrap"><DocumentUploadModal><Button variant="outline">Upload Document</Button></DocumentUploadModal><Button asChild><Link to="/dashboard/sessions/new">New Session</Link></Button></div></div>
    <QueryState pending={query.isPending} error={query.error} retry={query.refetch} />
    {query.data && <>
      <div className="grid md:grid-cols-3 gap-6">{[["Active Sessions", query.data.sessions.filter((s) => s.status === "in_progress").length], ["Pending Reviews", query.data.sessions.filter((s) => s.requiresFollowUp).length], ["Documents", query.data.documents.length]].map(([label, value]) => <div key={label} className="border rounded-xl p-6"><div className="text-5xl font-semibold tracking-tight">{value}</div><p className="mt-2 text-muted-foreground">{label}</p></div>)}</div>
      <section aria-label="Coordinator inbox" className="space-y-4"><div className="flex flex-wrap justify-between gap-3"><h2 className="text-2xl font-semibold">Coordinator inbox</h2><Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>Refresh dashboard</Button></div><p className="text-muted-foreground">Unassigned follow-ups and items assigned to you.</p>
        {!query.data.notifications.length && <p>No pending inbox items.</p>}
        {query.data.notifications.map((item) => <div key={item.id} className="border rounded-xl p-4 space-y-2"><p>{item.overdue && <strong>Overdue · </strong>}{item.studyId} · {item.description}</p>{item.dueAt && <p>Due {new Date(item.dueAt).toLocaleDateString()}</p>}<Link className="inline-flex min-h-11 items-center underline" to={`/dashboard/sessions/${encodeURIComponent(item.sessionId)}/report`}>Open follow-up</Link></div>)}
      </section>
      <section className="space-y-6"><div className="flex justify-between items-center"><h2 className="text-3xl font-semibold">Recent Sessions</h2><Link className="underline" to="/dashboard/sessions">View all</Link></div><SessionTable sessions={query.data.sessions.slice(0, 5)} /></section>
    </>}
  </div>;
}
