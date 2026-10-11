import { useEffect, useRef, useState } from "react";
import type { Conversation } from "@elevenlabs/client";
import { backendApi } from "@/lib/backend-api";
import { apiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

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
      const call = await Conversation.startSession({
        signedUrl, dynamicVariables, connectionType: "websocket",
        onMessage: ({ role, message }) => {
          if (mounted.current) callbacks.current.onMessage(role === "user" ? "patient" : "ai", message);
        },
        onStatusChange: ({ status }) => { if (mounted.current) setStatus(status); },
        onError: (message) => { if (mounted.current) callbacks.current.onError(message); },
        onDisconnect: () => {
          disconnected = true;
          conversation.current = null;
          if (mounted.current) {
            setStatus("disconnected");
            callbacks.current.onBusy(false);
            callbacks.current.onEnd();
          }
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
    <div className="space-y-2">
      <p role="status">Voice: {status}</p>
      {status === "disconnected" ? (
        <Button variant="outline" disabled={disabled} onClick={() => void start()}>Start voice conversation</Button>
      ) : (
        <Button variant="outline" disabled={status === "connecting" || status === "disconnecting"} onClick={() => {
          void conversation.current?.endSession().catch((error: unknown) => onError(apiError(error)));
        }}>End voice conversation</Button>
      )}
    </div>
  );
}
