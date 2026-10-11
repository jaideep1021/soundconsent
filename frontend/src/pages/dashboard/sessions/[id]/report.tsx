import { useState } from "react";
import { Link, useParams } from "react-router";
import { useSessionStore } from "@/stores/session-store";
import { NotFound } from "@/components/shared/not-found";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ReportScore } from "@/components/dashboard/report-score";
import { toast } from "sonner";
export default function UnderstandingReportPage() {
  const { id } = useParams();
  const { records, updateRecord } = useSessionStore();
  const session = records.find((s) => s.id === id);
  const [followUp, setFollowUp] = useState("");
  const [error, setError] = useState("");
  if (!session) return <NotFound title="Report not found" />;
  const flagged = session.sections.filter((s) => s.status === "needs-review");
  const sections = [
    ...flagged,
    ...session.sections.filter((s) => s.status !== "needs-review"),
  ];
  const download = () => {
    const report = [
      "DEMO — Teach-It-Back Understanding Report",
      `Patient: ${session.patientName}`,
      `Procedure: ${session.procedureName}`,
      `Flag: ${session.flagged ? "Open" : "Acknowledged / none"}`,
      ...sections.flatMap((s) => [
        "",
        s.title,
        `Status: ${s.status}`,
        `Response: ${s.patientResponse || "Not recorded"}`,
        `Assessment: ${s.aiAssessment || "Not assessed"}`,
      ]),
      "",
      "Questions:",
      ...(session.inquiries || []),
      "",
      `Follow-up: ${session.followUpAt || "Not scheduled"}`,
      `Demo signature: ${session.signature?.name || "Not signed"}`,
      `Signed at: ${session.signature?.signedAt || "—"}`,
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob([report], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `demo-report-${session.id}.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="space-y-8 max-w-4xl">
      <Link className="underline print:hidden" to={`/dashboard/sessions/${id}`}>
        Back to Session
      </Link>
      <div className="space-y-3">
        <h1 className="text-4xl font-semibold">Understanding Report</h1>
        <p>
          {session.patientName} · {session.procedureName}
        </p>
        <p className="text-sm text-muted-foreground">
          Demo report · Sample assessments are illustrative. Newly recorded
          responses remain unevaluated.
        </p>
      </div>
      <div className="flex flex-wrap gap-3 print:hidden">
        <Button variant="outline" onClick={() => window.print()}>
          Print / Save PDF
        </Button>
        <Button variant="outline" onClick={download}>
          Download Report (.txt)
        </Button>
        <Button
          disabled={!!session.flagged}
          onClick={() => {
            updateRecord(session.id, {
              flagged: true,
              acknowledgedAt: undefined,
            });
            toast.success("Flag saved locally. No notification was sent.");
          }}
        >
          {session.flagged ? "Flagged for Nurse" : "Flag for Nurse"}
        </Button>
      </div>
      <section className="border rounded-xl p-6 flex items-center gap-6">
        <ReportScore
          passed={
            session.sections.filter((s) => s.status === "completed").length
          }
          total={session.sections.length}
        />
        <div>
          <h2 className="text-xl font-semibold">Assessment status</h2>
          <p className="text-muted-foreground">
            {flagged.length} sections need review.{" "}
            {
              session.sections.filter(
                (s) => s.status === "pending" || s.status === "active",
              ).length
            }{" "}
            sections are unfinished.
          </p>
        </div>
      </section>
      {session.flagged && (
        <section className="border border-destructive/40 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-destructive">
            Needs Follow-Up (Priority)
          </h2>
          <p>
            {flagged.length
              ? flagged.map((s) => s.title).join(", ")
              : "Coordinator requested follow-up."}
          </p>
          <Button
            className="print:hidden"
            onClick={() => {
              updateRecord(session.id, {
                flagged: false,
                acknowledgedAt: new Date().toISOString(),
              });
              toast.success(
                "Flag acknowledged. Section assessments are unchanged.",
              );
            }}
          >
            Acknowledge & Clear Flag
          </Button>
        </section>
      )}
      {session.acknowledgedAt && (
        <p role="status" className="text-sm text-muted-foreground">
          Flag acknowledged {new Date(session.acknowledgedAt).toLocaleString()}.
          Sections needing review remain listed below.
        </p>
      )}
      {!!session.inquiries?.length && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">
            Unresolved Patient Inquiries
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            {session.inquiries.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </section>
      )}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Section Responses</h2>
        {sections.map((s) => (
          <details
            key={s.id}
            open={s.status === "needs-review"}
            className="border rounded-xl p-5"
          >
            <summary className="min-h-11 cursor-pointer">
              <span className="font-semibold mr-3">{s.title}</span>
              <Badge
                variant={s.status === "needs-review" ? "failed" : "secondary"}
              >
                {s.status}
              </Badge>
            </summary>
            <div className="space-y-3 mt-3">
              <h3 className="text-sm font-semibold">Patient response</h3>
              <p className="whitespace-pre-wrap">
                {s.patientResponse || "No response recorded."}
              </p>
              <h3 className="text-sm font-semibold">Assessment</h3>
              <p className="text-muted-foreground">
                {s.aiAssessment || "No assessment available."}
              </p>
              {session.messages
                .filter((m) => m.sectionId === s.id)
                .map((m) => (
                  <p key={m.id} className="text-sm">
                    <strong>
                      {m.role === "patient" ? "Patient" : "Demo assistant"}:
                    </strong>{" "}
                    {m.content}
                  </p>
                ))}
            </div>
          </details>
        ))}
      </section>
      <section className="border rounded-xl p-6 space-y-4 print:hidden">
        <h2 className="text-xl font-semibold">Schedule Follow-Up</h2>
        <p className="text-sm text-muted-foreground">
          Save a reminder in this demo tab. No appointment or notification is
          sent.
        </p>
        {session.followUpAt && (
          <p role="status">
            Saved for {new Date(session.followUpAt).toLocaleString()}
          </p>
        )}
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const date = new Date(followUp);
            if (
              !followUp ||
              Number.isNaN(date.getTime()) ||
              date <= new Date()
            ) {
              setError("Choose a future date and time.");
              return;
            }
            updateRecord(session.id, { followUpAt: date.toISOString() });
            setError("");
            toast.success("Follow-up saved locally.");
          }}
        >
          <label htmlFor="follow-up">Follow-up date and time</label>
          <Input
            id="follow-up"
            type="datetime-local"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            aria-describedby="follow-up-error"
          />
          <p id="follow-up-error" role="alert" className="text-destructive">
            {error}
          </p>
          <Button type="submit">Save Follow-Up</Button>
        </form>
      </section>
      {session.signature && (
        <p>
          Demo signature: {session.signature.name} ·{" "}
          {new Date(session.signature.signedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
