import { useEffect, useRef, useState } from "react";
import type { Conversation } from "@elevenlabs/client";
import { backendApi } from "@/lib/backend-api";
import { apiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { AudioLines, LoaderCircle, PhoneOff } from "lucide-react";
import { createVoiceTools } from "@/lib/voice-tools";

export function VoiceControl({ sessionId, disabled, onBusy, onMessage, onEnd, onError }: {
  sessionId: string; disabled: boolean;
  onBusy: (busy: boolean) => void;
  onMessage: (role: "ai" | "patient", content: string) => void;
  onEnd: () => void;
  onError: (error: string) => void;
}) {
  const conversation = useRef<Conversation | null>(null);
  const mounted = useRef(false);
  const starting = useRef(false);
  const callbacks = useRef({ onBusy, onMessage, onEnd, onError });
  useEffect(() => { callbacks.current = { onBusy, onMessage, onEnd, onError }; }, [onBusy, onMessage, onEnd, onError]);
  const [status, setStatus] = useState("disconnected");
  const [mode, setMode] = useState("listening");
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      callbacks.current.onBusy(false);
      void conversation.current?.endSession().catch(() => {});
    };
  }, []);
  const start = async () => {
    if (starting.current || conversation.current) return;
    starting.current = true;
    onBusy(true);
    setStatus("connecting");
    try {
      const { signedUrl, dynamicVariables } = await backendApi.conversation(sessionId);
      if (!mounted.current) return;
      const { Conversation } = await import("@elevenlabs/client");
      if (!mounted.current) return;
      let disconnected = false;
      const revision = /^\d+$/.test(dynamicVariables.session_revision ?? "")
        ? Number(dynamicVariables.session_revision) : (await backendApi.session(sessionId)).revision;
      if (!mounted.current) return;
      const voiceTools = createVoiceTools(sessionId, revision, (message) => {
        if (mounted.current) callbacks.current.onError(message);
      }, () => mounted.current && !disconnected);
      const call = await Conversation.startSession({
        signedUrl, dynamicVariables, connectionType: "websocket", textOnly: false,
        clientTools: voiceTools.clientTools,
        onMessage: ({ role, message }) => {
          if (mounted.current) callbacks.current.onMessage(role === "user" ? "patient" : "ai", message);
        },
        onStatusChange: ({ status }) => { if (mounted.current) setStatus(status); },
        onModeChange: ({ mode }) => { if (mounted.current) setMode(mode); },
        onError: (message) => { if (mounted.current) callbacks.current.onError(message); },
        onDisconnect: () => {
          disconnected = true;
          conversation.current = null;
          if (mounted.current) setStatus("disconnecting");
          void voiceTools.settled().then(() => {
            if (mounted.current) {
              setStatus("disconnected");
              callbacks.current.onBusy(false);
              callbacks.current.onEnd();
            }
          });
        },
      });
      if (!mounted.current) { await call.endSession(); return; }
      if (!disconnected) conversation.current = call;
    } catch (error) {
      if (mounted.current) {
        setStatus("disconnected");
        callbacks.current.onBusy(false);
        callbacks.current.onError(apiError(error));
      }
    } finally { starting.current = false; }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== "disconnected" && <p role="status" className="text-sm text-muted-foreground">{status === "connecting" ? "Connecting voice…" : status === "disconnecting" ? "Ending voice…" : mode === "speaking" ? "Assistant speaking…" : "Listening to you…"}</p>}
      {status === "disconnected" ? (
        <Button type="button" variant="outline" className="gap-2" title="Speak with the assistant and hear its replies" disabled={disabled} onClick={() => void start()}><AudioLines className="size-4" />Voice mode</Button>
      ) : (
        <Button type="button" variant="outline" className="gap-2" disabled={status === "connecting" || status === "disconnecting"} onClick={() => {
          setStatus("disconnecting");
          void conversation.current?.endSession().catch((error: unknown) => { setStatus("connected"); onError(apiError(error)); });
        }}>{status === "connecting" || status === "disconnecting" ? <LoaderCircle className="size-4 animate-spin" /> : <PhoneOff className="size-4" />}End voice mode</Button>
      )}
    </div>
  );
}
