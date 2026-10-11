import { useState } from "react";
import { backendApi, type BackendUser } from "@/lib/backend-api";
import { apiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export function CoordinatorLogin({ onLogin }: { onLogin: (user: BackendUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <form className="border rounded-xl p-5 space-y-4 max-w-lg" onSubmit={async (event) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError("");
    try { const user = await backendApi.login(email, password); setPassword(""); onLogin(user); }
    catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  }}>
    <h2 className="text-2xl font-semibold">Coordinator sign in</h2>
    <label className="block" htmlFor="coordinator-email">Email</label>
    <Input id="coordinator-email" type="email" autoComplete="username" required maxLength={254} disabled={busy} value={email} onChange={(e) => setEmail(e.target.value)} />
    <label className="block" htmlFor="coordinator-password">Password</label>
    <Input id="coordinator-password" type="password" autoComplete="current-password" required maxLength={256} disabled={busy} value={password} onChange={(e) => setPassword(e.target.value)} />
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <Button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
  </form>;
}
