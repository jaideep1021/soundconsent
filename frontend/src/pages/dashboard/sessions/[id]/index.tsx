import { useState } from "react";
import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { backendApi } from "@/lib/backend-api";
import { queryClient } from "@/lib/query-client";
import { ReviewConversation } from "@/components/patient/review";
import { PatientInvitation } from "@/components/dashboard/patient-invitation";
import { QueryState } from "@/components/shared/query-state";
import { Button } from "@/components/ui/button";
export default function SessionDetail() {
  const { id = "" } = useParams();
  const query = useQuery({ queryKey: ["coordinator", "session", id], queryFn: () => backendApi.session(id) });
  const [busy, setBusy] = useState(false);
  return <div className="max-w-4xl space-y-8">
    <Link className="underline" to="/dashboard/sessions">Back to Sessions</Link>
    <div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-4xl font-semibold">Session review</h1><Button asChild variant="outline"><Link to={`/dashboard/sessions/${encodeURIComponent(id)}/report`}>View Report</Link></Button></div>
    <QueryState pending={query.isPending} error={query.error} retry={query.refetch} />
    {query.data && <><PatientInvitation key={`invitation:${id}`} sessionId={id} disabled={busy} /><ReviewConversation key={`review:${id}`} sessionId={id} onBusyChange={setBusy} onAccessDenied={() => { queryClient.removeQueries({ queryKey: ["coordinator"] }); queryClient.setQueryData(["auth"], null); }} /></>}
  </div>;
}
