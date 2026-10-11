import { useRef, useState } from "react";
import { backendApi } from "@/lib/backend-api";
import { apiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export function PatientInvitation({ sessionId, disabled = false }: { sessionId: string; disabled?: boolean }) {
  const [invitation, setInvitation] = useState<Awaited<ReturnType<typeof backendApi.invite>> | null>(null);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  const run = async (action: () => Promise<void>) => { if (lock.current) return; lock.current = true; setBusy(true); setError(""); setNotice(""); try { await action(); } catch (e) { setError(apiError(e)); } finally { lock.current = false; setBusy(false); } };
  return <section aria-label="Patient access" className="border rounded-xl p-5 space-y-4">
    <h2 className="text-2xl font-semibold">Patient access</h2>
    <p>Invite a patient by their username. The study will appear on their homepage, and they can return with their password anytime.</p>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void run(async () => { await backendApi.invitePatient(sessionId, username); setInvitation(null); setNotice(`Study added to ${username.trim()}'s homepage.`); }); }}>
      <label className="block" htmlFor="invite-username">Patient username</label><Input id="invite-username" required maxLength={40} autoCapitalize="none" autoComplete="off" value={username} disabled={disabled || busy} onChange={(e) => setUsername(e.target.value)} /><Button type="submit" disabled={disabled || busy || !username.trim()}>Invite to study</Button>
    </form>
    <p className="text-sm text-muted-foreground">No account yet? Share a first-time invitation link and its access code separately. The patient creates an account and uses the code once to save the study.</p>
    <div className="flex flex-wrap gap-3"><Button disabled={disabled || busy} onClick={() => void run(async () => { setInvitation(await backendApi.invite(sessionId)); })}>Create first-time invitation</Button><Button variant="outline" disabled={disabled || busy} onClick={() => void run(async () => { await backendApi.revoke(sessionId); setInvitation(null); setNotice("Patient access and outstanding invitations revoked."); })}>Revoke patient access</Button></div>
    {invitation && <div className="space-y-3"><label className="block" htmlFor="invitation-link">Patient invitation link</label><Input id="invitation-link" readOnly value={`${window.location.origin}/session/${encodeURIComponent(sessionId)}#invite=${encodeURIComponent(invitation.invitationToken)}`} /><label className="block" htmlFor="access-code">Patient access code</label><Input id="access-code" readOnly value={invitation.accessCode} /><p>Expires {new Date(invitation.expiresAt).toLocaleString()}. Copy both now; they are not shown again after reload.</p></div>}
  </section>;
}
