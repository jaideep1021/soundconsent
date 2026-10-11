import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { backendApi } from "@/lib/backend-api";
import { UnderstandingReport } from "@/components/dashboard/understanding-report";
import { FollowUps } from "@/components/dashboard/follow-ups";
import { QueryState } from "@/components/shared/query-state";
import { Button } from "@/components/ui/button";
export default function SessionReportPage() {
  const { id = "" } = useParams();
  const query = useQuery({ queryKey: ["coordinator", "report", id], queryFn: () => backendApi.report(id), refetchInterval: 15000 });
  return <div className="max-w-4xl space-y-8">
    <Link className="underline" to={`/dashboard/sessions/${encodeURIComponent(id)}`}>Back to Session</Link>
    <div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-4xl font-semibold">Session report</h1><Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>Refresh report</Button></div>
    <QueryState pending={query.isPending} error={query.error} retry={query.refetch} />
    {query.data && <><UnderstandingReport report={query.data} /><FollowUps key={id} sessionId={id} onUpdated={() => void query.refetch()} /></>}
  </div>;
}
