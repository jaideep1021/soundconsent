import { useEffect, useId, useState } from "react";
import { backendApi, type FollowUpFlag } from "@/lib/backend-api";
import { apiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { NotificationDelivery } from "./notification-delivery";
import { Input } from "@/components/ui/input";

export function FollowUps({ sessionId, onUpdated }: { sessionId: string; onUpdated?: () => void }) {
  const [description, setDescription] = useState("");
  const [adding, setAdding] = useState(false);
  const [data, setData] = useState<Awaited<ReturnType<typeof backendApi.followUps>> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { let active = true; backendApi.followUps(sessionId).then((d) => { if (active) setData(d); }).catch((e: unknown) => { if (active) setError(apiError(e)); }); return () => { active = false; }; }, [sessionId]);
  return <section aria-label="Clinical follow-up" className="border rounded-xl p-5 space-y-4">
    <h2 className="text-2xl font-semibold">Clinical follow-up</h2>
    <p>Acknowledging a flag records that a coordinator has seen it. Resolve it only after the clinical team addresses it. Original assessment results remain in the report.</p>
    {error && <p role="alert">{error}</p>}
    <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); if (adding) return; setAdding(true); setError(""); try { await backendApi.addFollowUp(sessionId, description); setDescription(""); setData(await backendApi.followUps(sessionId)); onUpdated?.(); } catch (err) { setError(apiError(err)); } finally { setAdding(false); } }}>
      <label className="block" htmlFor="manual-followup">Additional follow-up</label><Input id="manual-followup" required maxLength={2000} disabled={adding} value={description} onChange={(e) => setDescription(e.target.value)} />
      <Button type="submit" disabled={adding || !description.trim()}>Add follow-up flag</Button>
    </form>
    <Button variant="outline" onClick={() => { setError(""); void backendApi.followUps(sessionId).then(setData).catch((e: unknown) => setError(apiError(e))); }}>Refresh follow-ups</Button>
    {data && !data.flags.length && <p>No follow-up flags recorded.</p>}
    {data && <NotificationDelivery sessionId={sessionId} flags={data.flags} />}
    {data?.flags.map((flag) => <FlagEditor key={`${flag.id}:${flag.revision}`} flag={flag} assignees={data.assignees} onSave={async (next, note) => { await backendApi.updateFollowUp(sessionId, next, note); setData(await backendApi.followUps(sessionId)); onUpdated?.(); }} />)}
  </section>;
}
function FlagEditor({ flag, assignees, onSave }: { flag: FollowUpFlag; assignees: { id: string; name: string }[]; onSave: (flag: FollowUpFlag, note: string) => Promise<void> }) {
  const [value, setValue] = useState(flag);
  const fieldId = useId();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <form className="border rounded p-4 space-y-3" onSubmit={async (e) => { e.preventDefault(); if (busy) return; setBusy(true); setError(""); try { await onSave(value, note); } catch (err) { setError(apiError(err)); } finally { setBusy(false); } }}>
    <p className="whitespace-pre-wrap">{flag.description}</p>
    <label className="block" htmlFor={`${fieldId}-status`}>Follow-up status</label><select id={`${fieldId}-status`} className="border p-2" disabled={busy} value={value.status} onChange={(e) => setValue({ ...value, status: e.target.value as FollowUpFlag["status"] })}><option value="open">Open</option><option value="acknowledged">Acknowledged</option><option value="resolved">Resolved</option></select>
    <label className="block" htmlFor={`${fieldId}-assignee`}>Assigned coordinator</label><select id={`${fieldId}-assignee`} className="border p-2" disabled={busy} value={value.assigneeId ?? ""} onChange={(e) => setValue({ ...value, assigneeId: e.target.value || null })}><option value="">Unassigned</option>{assignees.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
    <label className="block">Due date (UTC)<Input type="date" disabled={busy} value={value.dueAt?.slice(0, 10) ?? ""} onChange={(e) => setValue({ ...value, dueAt: e.target.value ? `${e.target.value}T23:59:59.000Z` : null })} /></label>
    <label className="block">Follow-up note (required to resolve)<textarea className="w-full min-h-24 border rounded p-3" required={value.status === "resolved"} maxLength={2000} disabled={busy} value={note} onChange={(e) => setNote(e.target.value)} /></label>
    {error && <p role="alert">{error}</p>}
    <Button type="submit" disabled={busy}>Save follow-up</Button>
    <details><summary className="min-h-11 cursor-pointer">Follow-up history ({flag.history.length})</summary>{flag.history.map((h, i) => <p key={i}>{new Date(h.at).toLocaleString()} · {h.status} · {h.note} · Coordinator {assignees.find((a) => a.id === h.accountId)?.name ?? h.accountId}</p>)}</details>
  </form>;
}
