import { useLocation } from "react-router";
import { usePatientSession } from "@/hooks/patient-session";
import { ReviewConversation } from "@/components/patient/review";
export default function SessionConversationPage() {
  const { snapshot, setSnapshot, onAccessDenied, setBusy } = usePatientSession();
  const voice = useLocation().pathname.endsWith("/voice");
  return <div className="space-y-6"><h1 className="text-3xl font-semibold">{voice ? "Voice review" : "Text review"}</h1>
    {voice && <p>Start a voice conversation or upload a recorded response. You can also type below if voice is unavailable.</p>}
    <ReviewConversation key={snapshot.sessionId} sessionId={snapshot.sessionId} mode={voice ? "voice" : "chat"} onAccessDenied={onAccessDenied} onBusyChange={setBusy} onSnapshot={setSnapshot} summaryLink={`/session/${snapshot.sessionId}/summary`} />
  </div>;
}
