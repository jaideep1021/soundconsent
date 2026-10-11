import type { BackendReport } from "@/lib/backend-api";
import { Button } from "@/components/ui/button";

export function UnderstandingReport({ report }: { report: BackendReport }) {
  return (
    <section aria-label="Understanding report" className="border rounded-xl p-5 space-y-4">
      <h2 className="text-2xl font-semibold">Understanding report</h2>
      <p className="break-all">Session: {report.sessionId}</p>
      <p>Study: {report.studyId} · Version: {report.documentVersion} · {report.status === "completed" ? "Review completed" : "Review in progress"}</p>
      <p>A human must discuss the final decision. Consent has not been obtained.</p>
      {report.acknowledgment && <p>Participant acknowledged review completion on {new Date(report.acknowledgment.acknowledgedAt).toLocaleString()}. {report.acknowledgment.text}</p>}
      {report.manualFlags.map((flag) => <p key={flag.id}>Coordinator follow-up: {flag.description}</p>)}
      {report.followUps.map((flag) => <details key={flag.flagId}><summary className="min-h-11">Follow-up {flag.flagId}: {flag.status}</summary>{flag.history.map((event, i) => <p key={i}>{new Date(event.at).toLocaleString()} · {event.status} · {event.note}</p>)}</details>)}
      {!report.sections.length && <p>No section assessments finalized yet.</p>}
      {report.sections.map((section, index) => (
        <details key={index} open={section.outcome === "needs_human_follow_up"} className="border rounded-lg p-3">
          <summary className="cursor-pointer min-h-11">{section.title} — {section.outcome === "passed" ? "Passed" : "Needs human follow-up"}</summary>
          <p>Attempts: {section.attempts}</p>
          <p className="whitespace-pre-wrap">{section.response}</p>
        </details>
      ))}
      <h3 className="font-semibold">Questions for the clinical team</h3>
      {report.outOfScopeQuestions.length ? <ul className="list-disc pl-5">{report.outOfScopeQuestions.map((q, i) => <li key={i}>{q.question}</li>)}</ul> : <p>No escalated questions recorded.</p>}
      <Button variant="outline" onClick={() => {
        const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = `understanding-report-${report.sessionId}.json`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}>Download report</Button>
    </section>
  );
}
