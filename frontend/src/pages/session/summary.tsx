import { Navigate } from "react-router";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { usePatientSession } from "@/hooks/patient-session";
import { ReviewAcknowledgment } from "@/components/patient/review-acknowledgment";
export default function SessionSummaryPage() {
  const { snapshot, refresh, onAccessDenied, setBusy } = usePatientSession();
  if (snapshot.status !== "completed") return <Navigate to={`/session/${snapshot.sessionId}/chat`} replace />;
  return <div className="space-y-8 pb-10">
    <div className="space-y-3"><CheckCircle2 className="size-10" /><h1 className="text-4xl font-semibold">Review completed</h1><p>{snapshot.documentTitle} · Version {snapshot.documentVersion}</p></div>
    <p className="text-muted-foreground">Discuss your questions and final decision with the clinical team. This review does not record consent to participate.</p>
    {snapshot.results.map((r) => <section key={r.sectionId} className="border rounded-xl p-5 space-y-2"><h2 className="font-semibold flex items-center gap-2">{!r.passed && <AlertTriangle className="size-5" />}{r.sectionTitle}</h2><p>{r.passed ? "Teach-back passed" : "Needs clinical follow-up"}</p><p className="whitespace-pre-wrap">{r.response}</p></section>)}
    {snapshot.outOfScopeQuestions.length > 0 && <section className="space-y-3"><h2 className="text-xl font-semibold">Questions for your clinical team</h2><ul className="list-disc pl-5">{snapshot.outOfScopeQuestions.map((q, i) => <li key={i}>{q.question}</li>)}</ul></section>}
    <ReviewAcknowledgment snapshot={snapshot} participant={snapshot.accessRole === "patient"} onSaved={refresh} onAccessDenied={onAccessDenied} onBusyChange={setBusy} />
  </div>;
}
