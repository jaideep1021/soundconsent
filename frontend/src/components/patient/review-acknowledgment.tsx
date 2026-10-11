import { useState } from "react";
import { backendApi, newMutation, type BackendSnapshot } from "@/lib/backend-api";
import { apiError, isUnauthorized } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
export function ReviewAcknowledgment({ snapshot, participant, onSaved, onAccessDenied, onBusyChange }: {
  snapshot: BackendSnapshot; participant: boolean; onSaved: () => Promise<void>; onAccessDenied: () => void; onBusyChange?: (busy: boolean) => void;
}) {
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (snapshot.status !== "completed") return null;
  return <section className="border rounded-xl p-5 space-y-4" aria-label="Review acknowledgment">
    <h2 className="text-2xl font-semibold">Review acknowledgment</h2>
    {error && <p role="alert">{error}</p>}
    {snapshot.acknowledgment ? <><p>{snapshot.acknowledgment.text}</p><p>Recorded {new Date(snapshot.acknowledgment.acknowledgedAt).toLocaleString()} for version {snapshot.acknowledgment.documentVersion}.</p></> : participant ? <>
      <label className="flex gap-3"><input type="checkbox" checked={accepted} disabled={busy} onChange={(e) => setAccepted(e.target.checked)} /><span>I acknowledge that I reviewed this form with an automated assistant. This records review completion only. It is not consent to participate. My questions and final decision must be discussed with the clinical team.</span></label>
      <Button disabled={!accepted || busy} onClick={async () => {
        setBusy(true); onBusyChange?.(true); setError("");
        try { await backendApi.acknowledge(snapshot.sessionId, newMutation(snapshot.revision)); await onSaved(); }
        catch (e) { if (isUnauthorized(e)) onAccessDenied(); else setError(apiError(e)); }
        finally { setBusy(false); onBusyChange?.(false); }
      }}>Acknowledge review completion</Button>
    </> : <p>The participant can acknowledge completion using their invitation. This does not record consent.</p>}
  </section>;
}
