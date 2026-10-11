import { useNavigate } from "react-router";
import { useSessionStore } from "@/stores/session-store";
import { Button } from "@/components/ui/button";
export default function SessionVoicePage() {
  const { session, setMode } = useSessionStore();
  const navigate = useNavigate();
  return (
    <div className="py-12 space-y-6 text-center">
      <h1 className="text-3xl font-semibold">
        Voice is unavailable in this demo
      </h1>
      <p className="text-muted-foreground">
        You can continue reviewing in text mode. Your progress is preserved.
      </p>
      <Button
        onClick={() => {
          setMode("chat");
          navigate(`/session/${session?.id}/chat`);
        }}
      >
        Continue with text
      </Button>
    </div>
  );
}
