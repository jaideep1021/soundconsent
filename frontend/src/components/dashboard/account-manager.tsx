import { useState } from "react";
import { backendApi, type BackendUser } from "@/lib/backend-api";
import { apiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export function AccountManager({ currentId }: { currentId: string }) {
  const [accounts, setAccounts] = useState<BackendUser[]>([]);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "coordinator">("coordinator"); const [studies, setStudies] = useState("");
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const run = async (action: () => Promise<void>) => { if (busy) return; setBusy(true); setMessage(""); try { await action(); setAccounts(await backendApi.accounts()); } catch (e) { setMessage(apiError(e)); } finally { setBusy(false); } };
  return <details className="border rounded-xl p-5"><summary className="min-h-11 cursor-pointer">Coordinator accounts</summary>
    <p>Administrators can access every study. Coordinators can access only their assigned studies. Disabling an account revokes its active sessions and patient invitations.</p>
    {message && <p role="status">{message}</p>}
    <Button disabled={busy} variant="outline" onClick={() => void run(async () => {})}>Refresh accounts</Button>
    {accounts.map((account) => <div className="py-3 border-b" key={account.id}><p>{account.name} · {account.email} · {account.role} · {account.disabled ? "Disabled" : "Active"}</p><p>{account.role === "admin" ? "All studies" : account.studyIds.join(", ") || "No assigned studies"}</p>{account.id !== currentId && !account.disabled && <details><summary className="min-h-11 cursor-pointer">Disable {account.name}</summary><Button disabled={busy} variant="outline" onClick={() => void run(async () => { await backendApi.disableAccount(account.id); setMessage("Account disabled and access revoked."); })}>Confirm disable {account.name}</Button></details>}</div>)}
    <form className="space-y-3 mt-4" onSubmit={(e) => { e.preventDefault(); void run(async () => { await backendApi.createAccount({ name, email, password, role, studyIds: role === "admin" ? [] : studies.split(",").map((s) => s.trim()).filter(Boolean) }); setPassword(""); setName(""); setEmail(""); setStudies(""); setMessage("Coordinator account created. Share the credentials through your organization's approved channel."); }); }}>
      <h3 className="font-semibold">Create coordinator account</h3>
      <label htmlFor="account-name" className="block">Account name</label><Input id="account-name" required maxLength={120} disabled={busy} value={name} onChange={(e) => setName(e.target.value)} />
      <label htmlFor="account-email" className="block">Account email</label><Input id="account-email" type="email" autoComplete="off" required maxLength={254} disabled={busy} value={email} onChange={(e) => setEmail(e.target.value)} />
      <label htmlFor="account-password" className="block">Initial password (12–256 characters)</label><Input id="account-password" type="password" autoComplete="new-password" required minLength={12} maxLength={256} disabled={busy} value={password} onChange={(e) => setPassword(e.target.value)} />
      <label htmlFor="account-role" className="block">Account role</label><select id="account-role" className="border p-3" disabled={busy} value={role} onChange={(e) => setRole(e.target.value as typeof role)}><option value="coordinator">Coordinator</option><option value="admin">Administrator</option></select>
      {role === "coordinator" && <><label htmlFor="account-studies" className="block">Assigned study IDs (comma-separated)</label><Input id="account-studies" disabled={busy} value={studies} onChange={(e) => setStudies(e.target.value)} /></>}
      <Button type="submit" disabled={busy}>Create account</Button>
    </form>
  </details>;
}
