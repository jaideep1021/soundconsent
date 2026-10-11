import { useLocation } from "react-router";
import { usePatientSession } from "@/hooks/patient-session";
import { ReviewConversation } from "@/components/patient/review";
export default function SessionConversationPage() {
  const { snapshot, setSnapshot, onAccessDenied, setBusy } = usePatientSession();
  const voice = useLocation().pathname.endsWith("/voice");
  return <div className="space-y-6"><h1 className="text-3xl font-semibold">Your review</h1>
    {voice && <p>Select Voice mode in the chat to speak with the assistant and hear its replies. You can also type or dictate a message.</p>}
    <ReviewConversation key={snapshot.sessionId} sessionId={snapshot.sessionId} onAccessDenied={onAccessDenied} onBusyChange={setBusy} onSnapshot={setSnapshot} summaryLink={`/session/${snapshot.sessionId}/summary`} />
  </div>;
}
