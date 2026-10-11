import { useState } from "react";
import { useCoordinator } from "@/hooks/use-coordinator";
import { backendApi } from "@/lib/backend-api";
import { apiError } from "@/lib/api-client";
import { StudySettingsPanel } from "@/components/dashboard/study-settings";
import { AccountManager } from "@/components/dashboard/account-manager";
import { Button } from "@/components/ui/button";
export default function SettingsPage() {
  const { data: user } = useCoordinator();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  if (!user) return null;
  return <div className="max-w-3xl space-y-8"><h1 className="text-4xl font-semibold">Settings</h1>
    <section className="border rounded-xl p-6 space-y-3"><h2 className="text-xl font-semibold">Account</h2><p>Signed in as {user.name} ({user.email})</p><p>{user.role === "admin" ? "Administrator · All studies" : `Coordinator · ${user.studyIds.join(", ") || "No studies assigned"}`}</p></section>
    <StudySettingsPanel admin={user.role === "admin"} />
    {user.role === "admin" && <><AccountManager currentId={user.id} /><section className="border rounded-xl p-6 space-y-3"><h2 className="text-xl font-semibold">Voice setup</h2><p>Configure provider credentials and the public webhook URL on the server, then provision or update the voice agent.</p>{message && <p role="status">{message}</p>}<Button disabled={busy} variant="outline" onClick={async () => { setBusy(true); setMessage(""); try { await backendApi.provision(); setMessage("Voice agent provisioned."); } catch (e) { setMessage(apiError(e)); } finally { setBusy(false); } }}>Provision voice agent</Button></section></>}
  </div>;
}
