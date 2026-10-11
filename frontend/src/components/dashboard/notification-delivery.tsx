import { useEffect, useState } from "react";
import { backendApi, type FollowUpFlag } from "@/lib/backend-api";
import { apiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
export function NotificationDelivery({ sessionId, flags }: { sessionId: string; flags: FollowUpFlag[] }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof backendApi.deliveries>> | null>(null);
  const [flagId, setFlagId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { let active = true; backendApi.deliveries().then((d) => { if (active) setData(d); }).catch((e: unknown) => { if (active) setMessage(apiError(e)); }); return () => { active = false; }; }, []);
  const run = async (action: () => Promise<void>) => { if (busy) return; setBusy(true); setMessage(""); try { await action(); setData(await backendApi.deliveries()); } catch (e) { setMessage(apiError(e)); } finally { setBusy(false); } };
  return <details><summary className="min-h-11 cursor-pointer">External notification delivery</summary>
    <p>{data?.enabled ? "External delivery is enabled. Alerts go through your organization's configured notification service. Overdue follow-ups also queue a reminder." : "External delivery is disabled. Follow-up flags and due dates remain available in the coordinator inbox."}</p>
    {message && <p role="status">{message}</p>}
    <label className="block" htmlFor="notification-flag">Follow-up to notify</label><select className="border p-2 max-w-full" id="notification-flag" disabled={busy || !data?.enabled} value={flagId} onChange={(e) => setFlagId(e.target.value)}><option value="">Choose a flag</option>{flags.filter((f) => f.status !== "resolved").map((f) => <option key={f.id} value={f.id}>{f.description.slice(0, 100)}</option>)}</select>
    <Button disabled={busy || !data?.enabled || !flagId} onClick={() => void run(async () => { const status = await backendApi.queueNotification(sessionId, flagId); setMessage(status === "pending" ? "Alert queued. Check delivery status for the outcome." : status === "delivered" ? "This alert was already accepted by the delivery service." : status === "failed" ? "The previous delivery failed. Use Retry failed delivery." : "The previous alert was cancelled. Update the follow-up before queuing a new alert."); })}>Queue external alert</Button>
    <Button disabled={busy} variant="outline" onClick={() => void run(async () => {})}>Refresh delivery status</Button>
    {data?.deliveries.filter((n) => n.sessionId === sessionId).map((n) => <div key={n.id} className="border-b py-2"><p>{n.kind === "reminder" ? "Reminder" : "Alert"} · {n.status === "delivered" ? "Accepted by delivery service" : n.status} · {n.attempts} attempt(s) · {new Date(n.createdAt).toLocaleString()}</p>{n.error && <p>{n.error}</p>}{n.status === "failed" && <Button disabled={busy || !data.enabled} variant="outline" onClick={() => void run(() => backendApi.retryNotification(n.id))}>Retry failed delivery</Button>}</div>)}
  </details>;
}
