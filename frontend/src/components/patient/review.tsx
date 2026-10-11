import axios from "axios";
import { Link } from "react-router";
import { ReviewAcknowledgment } from "./review-acknowledgment";
import { useCallback, useEffect, useRef, useState } from "react";
import { backendApi, newMutation, type Mutation, type BackendSnapshot } from "@/lib/backend-api";
import { apiError, isUnauthorized } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatBubble } from "@/components/patient/chat-bubble";
import { SectionProgress } from "@/components/patient/section-progress";
import { VoiceControl } from "./voice-control";
import type { Message } from "@/types/session";

export function ReviewConversation({ sessionId, onAccessDenied, onBusyChange, onSnapshot, summaryLink, mode = "all" }: {
  onSnapshot?: (snapshot: BackendSnapshot) => void; summaryLink?: string; mode?: "chat" | "voice" | "all"; sessionId: string; onAccessDenied: () => void; onBusyChange?: (busy: boolean) => void;
}) {
  const [snapshot, setSnapshot] = useState<BackendSnapshot | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [needsSync, setNeedsSync] = useState(false);
  const [text, setText] = useState("");
  const [intent, setIntent] = useState("response");
  const [speech, setSpeech] = useState("");
  const [liveMessages, setLiveMessages] = useState<Message[]>([]);
  const lock = useRef(false);
  const pending = useRef<{ content: string; mutation: Mutation } | null>(null);
  const draftRevision = useRef<number | undefined>(undefined);
  const log = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const [showLatest, setShowLatest] = useState(false);
  const latestRevision = useRef(-1);
  useEffect(() => { latestRevision.current = snapshot?.revision ?? -1; }, [snapshot?.revision]);
  useEffect(() => { if (snapshot) onSnapshot?.(snapshot); }, [snapshot, onSnapshot]);
  const denied = useRef(onAccessDenied);
  useEffect(() => { denied.current = onAccessDenied; }, [onAccessDenied]);
  const refresh = useCallback(async () => {
    const next = await backendApi.session(sessionId);
    setSnapshot(next); setNeedsSync(false); setLiveMessages([]); setSpeech("");
  }, [sessionId]);
  useEffect(() => {
    let active = true;
    backendApi.session(sessionId).then((next) => { if (active) setSnapshot(next); }).catch((e: unknown) => {
      if (active) { if (isUnauthorized(e)) denied.current(); else setError(apiError(e)); }
    });
    return () => { active = false; };
  }, [sessionId]);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        if (!lock.current && document.visibilityState === "visible") {
          const next = await backendApi.session(sessionId);
          if (active && !lock.current && next.revision > latestRevision.current) { setSnapshot(next); setLiveMessages([]); }
        }
      } catch (e) { if (active && isUnauthorized(e)) { setSnapshot(null); denied.current(); } }
      if (active) timer = setTimeout(() => void poll(), 2500);
    };
    timer = setTimeout(() => void poll(), 2500);
    return () => { active = false; clearTimeout(timer); };
  }, [sessionId]);
  useEffect(() => { onBusyChange?.(busy || voiceBusy); }, [busy, voiceBusy, onBusyChange]);
  useEffect(() => () => { if (speech) URL.revokeObjectURL(speech); }, [speech]);
  const messages: Array<Message & { citations?: string[] }> = [...(snapshot?.transcript ?? []), ...liveMessages];
  const scroll = () => { if (log.current) log.current.scrollTop = log.current.scrollHeight; nearBottom.current = true; setShowLatest(false); };
  useEffect(() => { if (nearBottom.current) scroll(); else setShowLatest(true); }, [messages.length]);
  const run = async (action: () => Promise<void>, mutation = false) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try { await action(); }
    catch (e) {
      if (isUnauthorized(e)) { setSnapshot(null); denied.current(); }
      else { if (axios.isAxiosError(e) && e.response?.status === 409) pending.current = null; setError(apiError(e)); if (mutation) setNeedsSync(true); }
    } finally { lock.current = false; setBusy(false); }
  };
  const locked = busy || voiceBusy;
  return <section className="space-y-5">
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {!snapshot ? <p role="status">{error ? "Unable to load review." : "Loading review…"}</p> : <>
      <h2 className="text-2xl font-semibold">{snapshot.status === "completed" ? "Review completed" : `Section ${snapshot.section.index} of ${snapshot.section.total}: ${snapshot.section.title}`}</h2>
      <p className="break-all">Review reference: {snapshot.sessionId}</p>
      <p>{snapshot.documentTitle} · Version {snapshot.documentVersion}</p>
      <p className="text-sm text-muted-foreground">{snapshot.disclosure}</p>
      <SectionProgress sections={snapshot.sections} currentSectionId={snapshot.sections.find((s) => s.status === "active")?.id} />
      {!snapshot.historyAvailable && <p>Earlier transcript history was not stored for this legacy session. Current progress is available.</p>}
      {snapshot.status !== "completed" && <p>Attempts on current section: {snapshot.attemptsForCurrentSection}</p>}
      {snapshot.sections.filter((s) => s.status === "active").map((s) => <details key={s.id}><summary className="min-h-11 cursor-pointer">Read source: {s.title}</summary><p className="whitespace-pre-wrap">{s.text}</p></details>)}
      {snapshot.guide && <details><summary className="min-h-11 cursor-pointer">Current section guide</summary><p className="whitespace-pre-wrap">{snapshot.guide.summary}</p><p>{snapshot.guide.question}</p></details>}
      <div ref={log} role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions" tabIndex={0} onScroll={(e) => {
        const el = e.currentTarget; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        if (nearBottom.current) setShowLatest(false);
      }} className="space-y-4 max-h-[32rem] overflow-y-auto p-2 border rounded-xl">
        {messages.map((message) => <ChatBubble key={message.id} message={{ ...message, content: message.content + (message.citations?.length ? `\n\nSources: ${message.citations.join(", ")}` : "") }} assistantLabel="AI Assistant" />)}
        {!messages.length && <p className="whitespace-pre-wrap">{snapshot.message}</p>}
      </div>
      {showLatest && <Button variant="outline" onClick={scroll}>Jump to latest messages</Button>}
      {snapshot.status === "completed" ? <p>Please discuss your final decision with the clinical team. This review does not record consent.</p> : <>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void run(async () => {
          const submitted = text.trim(); if (!submitted) return;
          const content = intent + ":" + submitted;
          if (pending.current?.content !== content) pending.current = { content, mutation: newMutation(draftRevision.current ?? snapshot.revision) };
          const result = intent === "question" ? await backendApi.ask(sessionId, submitted, pending.current.mutation) : await backendApi.respond(sessionId, submitted, pending.current.mutation);
          pending.current = null;
          setText(""); draftRevision.current = undefined; await refresh();
          if (result.requiresClinician) setNotice("Your question is saved for clinical follow-up. Contact your team directly for immediate help.");
        }, true); }}>
          <label className="block" htmlFor="intent">Message type</label>
          <select id="intent" className="border rounded p-3 bg-cream" disabled={locked || needsSync} value={intent} onChange={(e) => setIntent(e.target.value)}><option value="response">Teach-back response</option><option value="question">Question about the form</option></select>
          <label className="block" htmlFor="review-text">{intent === "question" ? "Your question" : "Your teach-back response"}</label>
          <textarea id="review-text" required maxLength={intent === "question" ? 2000 : 5000} value={text} disabled={locked || needsSync} onChange={(e) => { if (draftRevision.current === undefined) draftRevision.current = snapshot.revision; setText(e.target.value); }} className="w-full min-h-28 border rounded-lg p-3 bg-cream" />
          <p className="text-sm text-muted-foreground">The review advances after a pass or {snapshot.maxAttempts} failed attempt(s). Questions do not advance the section.</p>
          <Button type="submit" disabled={locked || needsSync || !text.trim()}>Send {intent === "question" ? "question" : "response"}</Button>
        </form>
        <label className="block" htmlFor="audio-response">Or submit a recorded teach-back response (audio, maximum 10 MiB)</label>
        <Input id="audio-response" type="file" accept="audio/*" disabled={locked || needsSync} onChange={(e) => {
          const audio = e.target.files?.[0]; e.target.value = ""; if (!audio) return;
          void run(async () => { if (!audio.size || audio.size > 10 * 1024 * 1024) throw new Error("Audio must be between 1 byte and 10 MiB."); const content = `audio:${audio.name}:${audio.size}:${audio.lastModified}`;
          if (pending.current?.content !== content) pending.current = { content, mutation: newMutation(snapshot.revision) };
          await backendApi.audio(sessionId, audio, pending.current.mutation); pending.current = null; await refresh(); }, true);
        }} />
        {mode !== "chat" && <VoiceControl sessionId={sessionId} disabled={busy || needsSync} onBusy={setVoiceBusy} onMessage={(role, content) => setLiveMessages((previous) => [...previous, { id: crypto.randomUUID(), role, content, timestamp: new Date().toISOString() }])} onError={setError} onEnd={() => { void run(refresh); }} />}
      </>}
      {snapshot.status === "completed" && (summaryLink ? <Button asChild><Link to={summaryLink}>Review summary</Link></Button> : <ReviewAcknowledgment snapshot={snapshot} participant={false} onSaved={refresh} onAccessDenied={onAccessDenied} onBusyChange={onBusyChange} />)}
      {needsSync && <p role="status">Refresh the review before continuing. The backend may have advanced the section.</p>}
      <Button variant="outline" disabled={locked || needsSync} onClick={() => void run(async () => { setSpeech(URL.createObjectURL(await backendApi.speech(sessionId))); })}>Listen to latest assistant response</Button>
      {speech && <audio aria-label="Latest assistant response" controls src={speech} />}
    </>}
    <Button variant="outline" disabled={locked} onClick={() => void run(async () => { await refresh(); if (!pending.current) { setText(""); draftRevision.current = undefined; } })}>Refresh review</Button>
  </section>;
}
