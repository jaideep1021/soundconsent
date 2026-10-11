import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ShieldCheck, BookOpen } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { backendApi, type PatientUser } from "@/lib/backend-api";
import { apiError, isUnauthorized } from "@/lib/api-client";
import { PatientLoginForm } from "@/components/auth/patient-login-form";
import { Button } from "@/components/ui/button";

function Studies({ user, onSignedOut }: { user: PatientUser; onSignedOut: () => void }) {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const query = useQuery({ queryKey: ["patient-studies", user.id], queryFn: backendApi.patientStudies, staleTime: 0, refetchInterval: 30000, retry: false });
  useEffect(() => { if (isUnauthorized(query.error)) onSignedOut(); }, [query.error, onSignedOut]);
  return <div className="space-y-8">
    <div className="flex flex-wrap justify-between items-start gap-4"><div className="space-y-2"><p className="text-muted-foreground">Signed in as {user.username}</p><h1 className="text-4xl font-semibold">My studies</h1><p>Your invited studies appear here. Pick up a review whenever you’re ready.</p></div><Button variant="outline" disabled={busy} onClick={async () => { setBusy(true); try { await backendApi.patientSignOut(); onSignedOut(); } catch (e) { setError(apiError(e)); } finally { setBusy(false); } }}>Sign out</Button></div>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {query.isPending && <p role="status">Loading your studies…</p>}
    {query.error && !isUnauthorized(query.error) && <div role="alert">{apiError(query.error)} <Button variant="outline" onClick={() => void query.refetch()}>Try again</Button></div>}
    {query.data?.length === 0 && <div className="border rounded-xl p-8 space-y-3"><BookOpen className="size-8" /><h2 className="text-2xl font-semibold">Your first study starts here</h2><p>Share your username, <strong>{user.username}</strong>, with your coordinator so they can invite you. If you received an invitation link and access code, open the link to add that study to your account.</p></div>}
    <div className="grid gap-5 sm:grid-cols-2">{query.data?.map((study) => <article key={study.sessionId} className="border rounded-xl p-6 space-y-4 bg-white/50">
      <div className="flex justify-between gap-3"><p className="text-sm text-muted-foreground">{study.studyId}</p><span className="text-sm font-medium">{study.status === "completed" ? "Completed" : study.isNew ? "New study" : "In progress"}</span></div>
      <h2 className="text-2xl font-semibold">{study.title}</h2><p className="text-muted-foreground">{study.reviewedSections} of {study.totalSections} sections reviewed</p>
      <Button disabled={busy} onClick={async () => { setBusy(true); setError(""); try { await backendApi.openPatientStudy(study.sessionId); navigate(`/session/${encodeURIComponent(study.sessionId)}/${study.status === "completed" ? "summary" : "overview"}`); } catch (e) { if (isUnauthorized(e)) onSignedOut(); else setError(apiError(e)); } finally { setBusy(false); } }}>{study.status === "completed" ? "View summary" : study.isNew ? "Start review" : "Continue review"}</Button>
    </article>)}</div>
    <p className="text-sm text-muted-foreground">Reviewing a study does not record consent to participate.</p>
  </div>;
}
export default function PatientHome() {
  const [user, setUser] = useState<PatientUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { let active = true; backendApi.patientMe().then((next) => { if (active) setUser(next); }).catch((e) => { if (active && !isUnauthorized(e)) setError(apiError(e)); }).finally(() => { if (active) setChecking(false); }); return () => { active = false; }; }, [attempt]);
  return <div className="min-h-dvh bg-cream text-charcoal"><header className="border-b px-6 py-4 flex flex-wrap justify-between gap-4"><Link to="/" className="font-semibold flex gap-2 items-center"><ShieldCheck className="size-5" />Teach-It-Back</Link><Link to="/login" className="text-sm underline">Coordinator sign in</Link></header><main id="main-content" className="max-w-4xl mx-auto p-6 py-12">{checking ? <p role="status">Checking sign in…</p> : error ? <div role="alert">{error} <Button onClick={() => { setChecking(true); setError(""); setAttempt(attempt + 1); }}>Try again</Button></div> : user ? <Studies user={user} onSignedOut={() => setUser(null)} /> : <PatientLoginForm onSuccess={setUser} />}</main></div>;
}
