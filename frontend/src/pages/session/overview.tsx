import { useState } from "react";
import { Link } from "react-router";
import { MessageSquare, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiDisclosure } from "@/components/patient/ai-disclosure";
import { usePatientSession } from "@/hooks/patient-session";
export default function SessionOverviewPage() {
  const { snapshot } = usePatientSession();
  const [mode, setMode] = useState("chat");
  return <div className="flex flex-col space-y-8 pb-10">
    <div className="space-y-3"><h1 className="text-4xl font-semibold tracking-tight">Your understanding review</h1><p className="text-lg text-muted-foreground">{snapshot.documentTitle} · Version {snapshot.documentVersion}</p></div>
    <AiDisclosure disclosure={snapshot.disclosure} />
    <section className="space-y-4"><h2 className="text-xl font-semibold">What we'll cover</h2><ol className="space-y-3 list-decimal pl-6">{snapshot.sections.map((s) => <li key={s.id}>{s.title}</li>)}</ol></section>
    {snapshot.status === "completed" ? <Button asChild><Link to={`/session/${snapshot.sessionId}/summary`}>Review summary</Link></Button> : <div className="pt-8 border-t space-y-6"><h2 className="text-xl font-semibold">How would you like to proceed?</h2><div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{([{ id: "chat", title: "Text Chat", description: "Read and type your responses", Icon: MessageSquare }, { id: "voice", title: "Voice Chat", description: "Speak with the assistant using your microphone", Icon: Mic }]).map(({ id, title, description, Icon }) => <button key={id} aria-pressed={mode === id} onClick={() => setMode(id)} className={`flex flex-col items-center p-6 border rounded-xl gap-3 ${mode === id ? 'border-charcoal bg-muted' : 'border-border'}`}><Icon className="size-6" /><span className="font-semibold">{title}</span><span className="text-sm text-muted-foreground">{description}</span></button>)}</div><Button asChild className="w-full"><Link to={`/session/${snapshot.sessionId}/${mode}`}>{snapshot.transcript.length > 1 ? "Continue review" : "I’m Ready to Begin"}</Link></Button></div>}
  </div>;
}
