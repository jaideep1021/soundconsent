import { useEffect, useRef, useState } from "react";
import { backendApi } from "@/lib/backend-api";
import { apiError } from "@/lib/api-client";

type DictationStatus = "idle" | "starting" | "recording" | "transcribing";

export function useDictation(sessionId: string, onTranscript: (text: string) => void, onError: (error: unknown) => void, enabled: boolean) {
  const [status, setStatus] = useState<DictationStatus>("idle");
  const state = useRef<DictationStatus>("idle");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const controller = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(false);
  const generation = useRef(0);
  const callbacks = useRef({ onTranscript, onError });
  useEffect(() => { callbacks.current = { onTranscript, onError }; }, [onTranscript, onError]);
  const changeStatus = (next: DictationStatus) => { state.current = next; if (mounted.current) setStatus(next); };
  const release = () => {
    clearTimeout(timer.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  };
  useEffect(() => {
    const effectGeneration = generation.current;
    mounted.current = enabled;
    if (!enabled) {
      state.current = "idle";
      // The external review state has closed the microphone; reflect that in the controls.
      // oxlint-disable-next-line react/set-state-in-effect
      setStatus("idle");
    }
    return () => {
      mounted.current = false;
      generation.current = effectGeneration + 1;
      controller.current?.abort();
      if (recorder.current) {
        recorder.current.onstop = null;
        recorder.current.ondataavailable = null;
        recorder.current.onerror = null;
        if (recorder.current.state !== "inactive") recorder.current.stop();
      }
      release();
    };
  }, [enabled, sessionId]);

  const toggle = async () => {
    if (!mounted.current) return;
    const currentGeneration = generation.current;
    if (state.current === "recording") {
      changeStatus("transcribing");
      recorder.current?.stop();
      release();
      return;
    }
    if (state.current !== "idle") return;
    changeStatus("starting");
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("Microphone dictation is unavailable in this browser. You can still type your message.");
      }
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current || currentGeneration !== generation.current) { media.getTracks().forEach((track) => track.stop()); return; }
      stream.current = media;
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find((mime) => MediaRecorder.isTypeSupported(mime));
      const recording = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
      recorder.current = recording;
      const chunks: Blob[] = [];
      let size = 0;
      let failed = false;
      recording.ondataavailable = (event) => {
        chunks.push(event.data);
        size += event.data.size;
        if (size > 10 * 1024 * 1024) {
          failed = true;
          if (recording.state !== "inactive") recording.stop();
          release();
          callbacks.current.onError(new Error("Recording is too long. Please dictate a shorter message."));
        }
      };
      recording.onerror = () => {
        failed = true;
        if (recording.state !== "inactive") recording.stop();
        release();
        changeStatus("idle");
        callbacks.current.onError(new Error("Microphone recording failed. Please try again."));
      };
      recording.onstop = async () => {
        release();
        recorder.current = null;
        if (!mounted.current) return;
        if (failed) { changeStatus("idle"); return; }
        changeStatus("transcribing");
        const request = new AbortController();
        controller.current = request;
        try {
          const audio = new Blob(chunks, { type: recording.mimeType || mimeType || "audio/webm" });
          if (!audio.size) throw new Error("No audio was recorded. Please try again.");
          const text = await backendApi.transcribe(sessionId, audio, request.signal);
          if (mounted.current && currentGeneration === generation.current) callbacks.current.onTranscript(text);
        } catch (error) {
          if (mounted.current && !request.signal.aborted) callbacks.current.onError(error);
        } finally {
          if (currentGeneration === generation.current) {
            controller.current = null;
            changeStatus("idle");
          }
        }
      };
      recording.start(1000);
      changeStatus("recording");
      timer.current = setTimeout(() => {
        if (recording.state === "recording") { changeStatus("transcribing"); recording.stop(); release(); }
      }, 120_000);
    } catch (error) {
      if (currentGeneration !== generation.current) return;
      release();
      changeStatus("idle");
      if (mounted.current) callbacks.current.onError(error instanceof DOMException && error.name === "NotAllowedError"
        ? new Error("Microphone access was denied. Allow microphone access in your browser to dictate, or type your message.")
        : new Error(apiError(error)));
    }
  };
  return { status, toggle, busy: status !== "idle" };
}
