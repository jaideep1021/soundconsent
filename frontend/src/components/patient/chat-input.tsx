import { useRef, type ReactNode } from "react";
import { ArrowUp, LoaderCircle, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatInputProps {
  text: string;
  onTextChange: (text: string) => void;
  onSend: () => void;
  disabled: boolean;
  dictationStatus: "idle" | "starting" | "recording" | "transcribing";
  onDictate: () => void;
  voiceControl: ReactNode;
}

export function ChatInput({ text, onTextChange, onSend, disabled, dictationStatus, onDictate, voiceControl }: ChatInputProps) {
  const form = useRef<HTMLFormElement>(null);
  const dictating = dictationStatus !== "idle";
  const micLabel = dictationStatus === "recording" ? "Stop dictation" : dictationStatus === "transcribing" ? "Transcribing…" : dictationStatus === "starting" ? "Connecting microphone…" : "Dictate message";
  return <form ref={form} aria-label="Message composer" onSubmit={(event) => {
    event.preventDefault();
    if (!disabled && !dictating && text.trim()) onSend();
  }} className="border-t border-border bg-off-white p-3 sm:p-4 space-y-3">
    <div className="flex justify-end">{voiceControl}</div>
    <label htmlFor="review-text" className="sr-only">Your message</label>
    <div className="rounded-2xl border border-border bg-cream p-2 focus-within:ring-2 focus-within:ring-ring">
      <textarea id="review-text" required maxLength={5000} value={text} disabled={disabled || dictating}
        onChange={(event) => onTextChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            form.current?.requestSubmit();
          }
        }}
        aria-describedby="composer-help" placeholder="Ask a question or explain what you understand…"
        className="block w-full min-h-24 max-h-60 resize-y bg-transparent p-2 text-base focus:outline-none disabled:opacity-60" />
      <div className="flex items-center justify-between gap-2">
        <Button type="button" size="icon" variant={dictationStatus === "recording" ? "destructive" : "ghost"}
          aria-label={micLabel} title={micLabel} aria-pressed={dictationStatus === "recording"}
          disabled={disabled || dictationStatus === "starting" || dictationStatus === "transcribing"} onClick={onDictate} className="size-11 rounded-full">
          {dictationStatus === "recording" ? <Square className="size-4" /> : dictationStatus === "idle" ? <Mic className="size-5" /> : <LoaderCircle className="size-5 animate-spin" />}
        </Button>
        <Button type="submit" size="icon" className="size-11 rounded-full" aria-label="Send message" disabled={disabled || dictating || !text.trim()}><ArrowUp className="size-5" /></Button>
      </div>
    </div>
    <p id="composer-help" role="status" className="text-xs text-muted-foreground">
      {dictationStatus === "recording" ? "Listening… Click the microphone again to stop and transcribe. Recording stops after 2 minutes."
        : dictationStatus === "transcribing" ? "Transcribing your words into a draft…"
        : dictationStatus === "starting" ? "Allow microphone access to start dictating."
        : "Enter to send · Shift + Enter for a new line. Dictation adds a draft for you to review before sending."}
    </p>
  </form>;
}
