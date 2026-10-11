import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useSessionStore } from "@/stores/session-store";
import { SectionProgress } from "@/components/patient/section-progress";
import { ChatBubble } from "@/components/patient/chat-bubble";
import { ChatInput } from "@/components/patient/chat-input";
import { Button } from "@/components/ui/button";
export default function SessionChatPage() {
  const { session, startReview, addMessage, advanceSection } =
    useSessionStore();
  const navigate = useNavigate();
  const viewport = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const [showLatest, setShowLatest] = useState(false);
  const active = session?.sections.find((s) => s.status === "active");
  useEffect(() => {
    startReview();
  }, [startReview, session?.id]);
  useEffect(() => {
    if (
      active &&
      !session?.messages.some(
        (m) => m.role === "ai" && m.sectionId === active.id,
      )
    ) {
      addMessage({
        role: "ai",
        content: `Demo prompt — ${active.title}: Please describe what you understand or record questions for your care team. This preview cannot answer medical questions or evaluate your understanding.`,
      });
    }
  }, [active, session?.messages, addMessage]);
  const scrollToBottom = () => {
    const element = viewport.current;
    if (element)
      element.scrollTo({
        top: element.scrollHeight,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    nearBottom.current = true;
    setShowLatest(false);
  };
  useEffect(() => {
    if (nearBottom.current) scrollToBottom();
    else setShowLatest(true);
  }, [session?.messages.length]);
  if (!session) return null;
  const reviewed =
    session.sections.length > 0 &&
    session.sections.every(
      (s) => s.status === "completed" || s.status === "needs-review",
    );
  return (
    <div className="flex flex-col min-h-0 h-[calc(100dvh-180px)] min-h-96 max-h-[850px]">
      <SectionProgress
        sections={session.sections}
        currentSectionId={active?.id}
      />
      <div
        ref={viewport}
        role="log"
        aria-label="Conversation"
        aria-live="polite"
        aria-relevant="additions"
        tabIndex={0}
        onScroll={(e) => {
          const v = e.currentTarget;
          nearBottom.current =
            v.scrollHeight - v.scrollTop - v.clientHeight < 80;
          if (nearBottom.current) setShowLatest(false);
        }}
        className="flex-1 min-h-0 overflow-y-auto px-1 py-4 space-y-4"
      >
        {session.messages.map((message) => (
          <ChatBubble key={message.id} message={message} />
        ))}
      </div>
      {showLatest && (
        <Button variant="outline" onClick={scrollToBottom}>
          Jump to latest messages
        </Button>
      )}
      <div className="pt-2 border-t border-border space-y-3">
        {reviewed ? (
          <Button
            className="w-full"
            onClick={() => navigate(`/session/${session.id}/summary`)}
          >
            Review summary
          </Button>
        ) : (
          <>
            {active?.summary && (
              <details>
                <summary className="min-h-11 flex items-center cursor-pointer underline">
                  Read section: {active.title}
                </summary>
                <p className="text-sm text-muted-foreground pb-3">
                  {active.summary}
                </p>
              </details>
            )}
            <ChatInput
              disabled={!active}
              onSendMessage={(text) => {
                addMessage({ role: "patient", content: text });
                addMessage({
                  role: "ai",
                  content:
                    "Your response has been recorded in this demo. You can add more details or questions before continuing. Please discuss unanswered questions with your care team.",
                });
              }}
            />
            <Button
              variant="outline"
              disabled={!active?.patientResponse}
              onClick={advanceSection}
              className="w-full"
            >
              Continue to{" "}
              {session.sections.some((s) => s.status === "pending")
                ? "next section"
                : "summary"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
