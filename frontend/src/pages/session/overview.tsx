import { Button } from "@/components/ui/button";
import { useParams, useNavigate } from "react-router";
import { useSessionStore } from "@/stores/session-store";
import { AiDisclosure } from "@/components/patient/ai-disclosure";
import { MessageSquare, Mic } from "lucide-react";

export default function SessionOverviewPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { session, setMode } = useSessionStore();

  if (!session) {
    return null;
  }

  const handleStart = () => navigate(`/session/${sessionId}/${session.mode}`);

  return (
    <div className="flex flex-col space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
      <div className="space-y-3">
        <h1 className="text-[36px] font-semibold text-charcoal tracking-[-0.9px] leading-tight">
          Reviewing your procedure
        </h1>
        <p className="text-lg text-muted-foreground">{session.procedureName}</p>
      </div>

      <p className="text-muted-foreground">
        Review the procedure, risks, alternatives, and aftercare at your own
        pace. You can record questions to discuss with your care team.
      </p>
      <AiDisclosure />

      <div className="space-y-4">
        <h2 className="text-[20px] font-semibold text-charcoal">
          What we'll cover:
        </h2>
        <ul className="space-y-3">
          {session.sections.map((section, index) => (
            <li key={section.id} className="flex gap-3 text-charcoal">
              <span className="text-muted-foreground w-6 text-right shrink-0">
                {index + 1}.
              </span>
              <span>{section.title}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="pt-8 border-t border-border space-y-6">
        <h2 className="text-[20px] font-semibold text-charcoal">
          How would you like to proceed?
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            aria-pressed={session.mode === "chat"}
            onClick={() => setMode("chat")}
            className="flex flex-col items-center p-6 bg-cream border border-border rounded-xl hover:border-border-interactive transition-colors text-left gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="w-12 h-12 bg-border rounded-full flex items-center justify-center text-charcoal">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div className="text-center">
              <div className="font-semibold text-charcoal mb-1">Text Chat</div>
              <div className="text-sm text-muted-foreground">
                Read and type your responses
              </div>
            </div>
          </button>

          <button
            disabled
            aria-describedby="voice-unavailable"
            className="flex flex-col items-center p-6 bg-cream border border-border rounded-xl hover:border-border-interactive transition-colors text-left gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="w-12 h-12 bg-border rounded-full flex items-center justify-center text-charcoal">
              <Mic className="w-6 h-6" />
            </div>
            <div className="text-center">
              <div className="font-semibold text-charcoal mb-1">Voice Chat</div>
              <div
                id="voice-unavailable"
                className="text-sm text-muted-foreground"
              >
                Unavailable in this demo
              </div>
            </div>
          </button>
        </div>
        <Button className="w-full" onClick={handleStart}>
          I’m Ready to Begin
        </Button>
      </div>
    </div>
  );
}
