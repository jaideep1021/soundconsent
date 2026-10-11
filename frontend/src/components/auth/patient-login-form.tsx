import { useState } from "react";
import { backendApi, type PatientUser } from "@/lib/backend-api";
import { apiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PatientLoginForm({ onSuccess }: { onSuccess: (user: PatientUser) => void }) {
  const [register, setRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <section className="space-y-6 w-full max-w-md mx-auto">
    <div className="space-y-2"><h1 className="text-3xl font-semibold">{register ? "Create your patient account" : "Patient sign in"}</h1><p className="text-muted-foreground">Your studies and review progress, all in one place. Sign in anytime with your username and password.</p></div>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <form className="space-y-4" onSubmit={async (event) => {
      event.preventDefault(); if (busy) return; setBusy(true); setError("");
      try { const user = await backendApi.patientSignIn(username, password, register); setPassword(""); onSuccess(user); }
      catch (e) { setError(apiError(e)); } finally { setBusy(false); }
    }}>
      <div className="space-y-2"><label htmlFor="patient-username">Username</label><Input id="patient-username" autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9._\-]{2,39}" disabled={busy} value={username} onChange={(e) => setUsername(e.target.value)} />{register && <p className="text-sm text-muted-foreground">3–40 characters: letters, numbers, dots, underscores or hyphens. Share this username with your coordinator.</p>}</div>
      <div className="space-y-2"><label htmlFor="patient-password">Password</label><Input id="patient-password" type="password" autoComplete={register ? "new-password" : "current-password"} required minLength={register ? 12 : 1} maxLength={256} disabled={busy} value={password} onChange={(e) => setPassword(e.target.value)} />{register && <p className="text-sm text-muted-foreground">Use at least 12 characters. A few memorable words work well.</p>}</div>
      <Button className="w-full" type="submit" disabled={busy}>{busy ? "Please wait…" : register ? "Create account" : "Sign in"}</Button>
    </form>
    <Button variant="outline" className="w-full" disabled={busy} onClick={() => { setRegister(!register); setError(""); setPassword(""); }}>{register ? "Already have an account? Sign in" : "New here? Create an account"}</Button>
  </section>;
}
