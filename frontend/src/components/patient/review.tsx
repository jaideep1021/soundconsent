import axios from "axios";
import { Link } from "react-router";
import { ReviewAcknowledgment } from "./review-acknowledgment";
import { useCallback, useEffect, useRef, useState } from "react";
import { backendApi, newMutation, type Mutation, type BackendSnapshot } from "@/lib/backend-api";
import { apiError, isUnauthorized } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { ChatInput } from "./chat-input";
import { useDictation } from "@/hooks/use-dictation";
import { ChatBubble } from "@/components/patient/chat-bubble";
import { SectionProgress } from "@/components/patient/section-progress";
import { VoiceControl } from "./voice-control";
import type { Message } from "@/types/session";
import { mergeReviewTranscript } from "@/lib/review-transcript";

export function ReviewConversation({ sessionId, onAccessDenied, onBusyChange, onSnapshot, summaryLink }: {
  onSnapshot?: (snapshot: BackendSnapshot) => void; summaryLink?: string; sessionId: string; onAccessDenied: () => void; onBusyChange?: (busy: boolean) => void;
}) {
  const [snapshot, setSnapshot] = useState<BackendSnapshot | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [needsSync, setNeedsSync] = useState(false);
  const [text, setText] = useState("");
  const [speech, setSpeech] = useState("");
  const [liveMessages, setLiveMessages] = useState<Message[]>([]);
  const voiceSaves = useRef<Promise<void>>(Promise.resolve());
  const unsavedVoice = useRef<Message[]>([]);
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
    setSnapshot(next); setNeedsSync(false); setSpeech("");
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
          if (active && !lock.current && next.revision > latestRevision.current) setSnapshot(next);
        }
      } catch (e) { if (active && isUnauthorized(e)) { setSnapshot(null); denied.current(); } }
      if (active) timer = setTimeout(() => void poll(), 2500);
    };
    timer = setTimeout(() => void poll(), 2500);
    return () => { active = false; clearTimeout(timer); };
  }, [sessionId]);

  useEffect(() => () => { if (speech) URL.revokeObjectURL(speech); }, [speech]);
  const messages = mergeReviewTranscript(snapshot?.transcript ?? [], [...liveMessages, ...(snapshot?.voiceTranscript ?? [])]);
  const saveVoice = () => {
    const write = voiceSaves.current.catch(() => {}).then(async () => {
      while (unsavedVoice.current.length) {
        const batch = unsavedVoice.current.slice(0, 100);
        await backendApi.saveVoiceTranscript(sessionId, batch);
        const ids = new Set(batch.map((message) => message.id));
        unsavedVoice.current = unsavedVoice.current.filter((message) => !ids.has(message.id));
      }
    });
    voiceSaves.current = write;
    return write;
  };
  const scroll = () => { if (log.current) log.current.scrollTop = log.current.scrollHeight; nearBottom.current = true; setShowLatest(false); };
  useEffect(() => { if (nearBottom.current) scroll(); else setShowLatest(true); }, [messages.length]);
  const run = async (action: () => Promise<void>, mutation = false) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try { await action(); }
    catch (e) {
      if (isUnauthorized(e)) { setSnapshot(null); denied.current(); }
      else {
        const conflict = axios.isAxiosError(e) && e.response?.status === 409;
        if (conflict) pending.current = null;
        setError(apiError(e));
        if (mutation) {
          setNeedsSync(true);
          if (!conflict) {
            // A provider failure must not strand the draft. Keep its request key
            // and unlock retries only after confirming the review did not advance.
            try {
              const next = await backendApi.session(sessionId);
              setSnapshot(next);
              if (next.revision === pending.current?.mutation.revision) setNeedsSync(false);
            } catch (syncError) {
              if (isUnauthorized(syncError)) { setSnapshot(null); denied.current(); }
            }
          }
        }
      }
    } finally { lock.current = false; setBusy(false); }
  };
  const changeText = (value: string) => {
    if (draftRevision.current === undefined) draftRevision.current = snapshot?.revision;
    setText(value);
  };
  const dictation = useDictation(sessionId, (transcript) => {
    setText((previous) => [previous.trimEnd(), transcript].filter(Boolean).join(" "));
    requestAnimationFrame(() => document.getElementById("review-text")?.focus());
  }, (error) => {
    if (isUnauthorized(error)) { setSnapshot(null); denied.current(); }
    else setError(apiError(error));
  }, snapshot?.status === "in_progress");
  useEffect(() => { onBusyChange?.(busy || voiceBusy || dictation.busy); }, [busy, voiceBusy, dictation.busy, onBusyChange]);
  const locked = busy || voiceBusy || dictation.busy;
  const send = () => {
    if (locked || needsSync || !snapshot) return;
    void run(async () => {
      const submitted = text.trim(); if (!submitted) return;
      const content = "message:" + submitted;
      if (pending.current?.content !== content) pending.current = { content, mutation: newMutation(draftRevision.current ?? snapshot.revision) };
      const result = await backendApi.message(sessionId, submitted, pending.current.mutation);
      pending.current = null;
      setText(""); draftRevision.current = undefined; await refresh();
      if (result.requiresClinician) setNotice("Your question is saved for clinical follow-up. Contact your team directly for immediate help.");
    }, true);
  };
  return <section className="space-y-5">
    {!snapshot && error && <p role="alert" className="text-destructive">{error}</p>}
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
      <div className="overflow-hidden rounded-2xl border border-border shadow-sm">
      <div ref={log} role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions" tabIndex={0} onScroll={(e) => {
        const el = e.currentTarget; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        if (nearBottom.current) setShowLatest(false);
      }} className="space-y-4 min-h-64 max-h-[50dvh] overflow-y-auto p-4 sm:p-6">
        {messages.map((message) => <ChatBubble key={message.id} message={{ ...message, content: message.content + (message.citations?.length ? `\n\nSources: ${message.citations.join(", ")}` : "") }} assistantLabel="AI Assistant" />)}
        {!messages.length && <p className="whitespace-pre-wrap">{snapshot.message}</p>}
      </div>
      {showLatest && <Button variant="outline" onClick={scroll}>Jump to latest messages</Button>}
      {error && <p role="alert" className="p-4 text-destructive">{error}</p>}
      {(snapshot.status !== "completed" || voiceBusy) && <ChatInput text={text} onTextChange={changeText}
        onSend={send} disabled={busy || voiceBusy || needsSync || snapshot.status === "completed"} dictationStatus={dictation.status}
        onDictate={() => {
          if (draftRevision.current === undefined) draftRevision.current = snapshot.revision;
          setError(""); setSpeech(""); void dictation.toggle();
        }}
        voiceControl={<VoiceControl sessionId={sessionId} disabled={busy || needsSync || dictation.busy || snapshot.status === "completed"}
          onBusy={(active) => { setVoiceBusy(active); if (active) { setSpeech(""); setError(""); } }}
          onMessage={(role, content) => {
            if (!content.trim()) return;
            const message = { id: crypto.randomUUID(), role, content, timestamp: new Date().toISOString() };
            setLiveMessages((previous) => [...previous, message]);
            unsavedVoice.current.push(message);
            void saveVoice().catch((e) => setError(`Voice history could not be saved: ${apiError(e)}`));
          }}
          onError={setError} onEnd={() => { void run(async () => { await saveVoice(); await refresh(); }); }} />} />}
      </div>
      {snapshot.status === "completed" ? <p>Please discuss your final decision with the clinical team. This review does not record consent.</p>
        : <p className="text-sm text-muted-foreground">Ask questions or explain your understanding in the same chat. Questions do not advance the section. The review advances after a pass or {snapshot.maxAttempts} failed attempt(s).</p>}
      {snapshot.status === "completed" && (summaryLink ? <Button asChild><Link to={summaryLink}>Review summary</Link></Button> : <ReviewAcknowledgment snapshot={snapshot} participant={false} onSaved={refresh} onAccessDenied={onAccessDenied} onBusyChange={onBusyChange} />)}
      {needsSync && <p role="status">Refresh the review before continuing. The backend may have advanced the section.</p>}
      <Button variant="outline" disabled={locked || needsSync} onClick={() => void run(async () => { setSpeech(URL.createObjectURL(await backendApi.speech(sessionId))); })}>Listen to latest assistant response</Button>
      {speech && <audio aria-label="Latest assistant response" controls src={speech} />}
    </>}
    <Button variant="outline" disabled={locked} onClick={() => void run(async () => { await refresh(); if (!pending.current) { setText(""); draftRevision.current = undefined; } })}>Refresh review</Button>
  </section>;
}
