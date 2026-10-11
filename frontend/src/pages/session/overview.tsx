import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { AiDisclosure } from "@/components/patient/ai-disclosure";
import { usePatientSession } from "@/hooks/patient-session";
export default function SessionOverviewPage() {
  const { snapshot } = usePatientSession();
  return <div className="flex flex-col space-y-8 pb-10">
    <div className="space-y-3"><h1 className="text-4xl font-semibold tracking-tight">Your understanding review</h1><p className="text-lg text-muted-foreground">{snapshot.documentTitle} · Version {snapshot.documentVersion}</p></div>
    <AiDisclosure disclosure={snapshot.disclosure} />
    <section className="space-y-4"><h2 className="text-xl font-semibold">What we'll cover</h2><ol className="space-y-3 list-decimal pl-6">{snapshot.sections.map((s) => <li key={s.id}>{s.title}</li>)}</ol></section>
    {snapshot.status === "completed" ? <Button asChild><Link to={`/session/${snapshot.sessionId}/summary`}>Review summary</Link></Button> : <div className="pt-8 border-t"><Button asChild className="w-full"><Link to={`/session/${snapshot.sessionId}/chat`}>{snapshot.transcript.length > 1 ? "Continue review" : "I’m Ready to Begin"}</Link></Button></div>}
  </div>;
}
