import { Link, useParams } from "react-router";
import { useSessionStore } from "@/stores/session-store";
import { sessionStatus } from "@/lib/session-status";
import { NotFound } from "@/components/shared/not-found";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
export default function SessionDetail() {
  const { id } = useParams();
  const session = useSessionStore((s) => s.records.find((s) => s.id === id));
  if (!session) return <NotFound title="Session not found" />;
  return (
    <div className="max-w-4xl space-y-8">
      <Link className="underline" to="/dashboard/sessions">
        Back to Sessions
      </Link>
      <div className="flex justify-between gap-4 flex-wrap">
        <div className="space-y-3">
          <Badge>{sessionStatus(session)}</Badge>
          <h1 className="text-4xl font-semibold">{session.patientName}</h1>
          <p className="text-muted-foreground">{session.procedureName}</p>
        </div>
        <Button asChild>
          <Link to={`/dashboard/sessions/${id}/report`}>View Report</Link>
        </Button>
      </div>
      <p className="text-muted-foreground">
        Mode: {session.mode} ·{" "}
        {
          session.sections.filter(
            (s) => s.status === "completed" || s.status === "needs-review",
          ).length
        }{" "}
        of {session.sections.length} sections reviewed
      </p>
      <h2 className="text-2xl font-semibold">Teach-Back Progress</h2>
      {session.sections.map((s) => (
        <div key={s.id} className="p-6 border rounded-xl space-y-2">
          <div className="flex justify-between gap-3">
            <h3 className="font-semibold">{s.title}</h3>
            <Badge
              variant={s.status === "needs-review" ? "failed" : "secondary"}
            >
              {s.status}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {s.aiAssessment || "No assessment available."}
          </p>
        </div>
      ))}
      <Button asChild variant="outline">
        <Link to={`/session/${id}`}>Open patient demo</Link>
      </Button>
    </div>
  );
}
