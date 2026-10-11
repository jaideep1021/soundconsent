import { useState } from "react";
import { backendApi, type StudySettings } from "@/lib/backend-api";
import { apiError } from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
export function StudySettingsPanel({ admin }: { admin: boolean }) {
  const [study, setStudy] = useState("");
  const [loadedStudy, setLoadedStudy] = useState("");
  const [settings, setSettings] = useState<StudySettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const run = async (action: () => Promise<void>) => { setBusy(true); setMessage(""); try { await action(); } catch (e) { setMessage(apiError(e)); } finally { setBusy(false); } };
  return <details className="border rounded-xl p-5"><summary className="min-h-11 cursor-pointer">Study settings</summary>
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void run(async () => { setSettings(await backendApi.settings(study.trim())); setLoadedStudy(study.trim()); }); }}><label htmlFor="settings-study">Study ID for settings</label><Input id="settings-study" required value={study} disabled={busy} onChange={(e) => { setStudy(e.target.value); setSettings(null); }} /><Button disabled={busy} type="submit">Load study settings</Button></form>
    {message && <p role="status">{message}</p>}
    {settings && <form className="space-y-3 mt-4" onSubmit={(e) => { e.preventDefault(); void run(async () => { setSettings(await backendApi.saveSettings(loadedStudy, settings)); setMessage("Study settings saved. Attempt limits apply to new reviews."); }); }}>
      <p>Settings for {loadedStudy}. Attempt limits are fixed when a review starts. Reminders appear in the coordinator inbox. External alerts require a configured and enabled delivery service.</p>
      <label className="block">Maximum teach-back attempts<Input type="number" min={1} max={3} required disabled={busy || !admin} value={settings.maxAttempts} onChange={(e) => setSettings({ ...settings, maxAttempts: Number(e.target.value) })} /></label>
      <label className="block">Default follow-up due after days<Input type="number" min={1} max={30} required disabled={busy || !admin} value={settings.reminderDays} onChange={(e) => setSettings({ ...settings, reminderDays: Number(e.target.value) })} /></label>
      <label className="flex gap-3"><input type="checkbox" disabled={busy || !admin} checked={settings.notificationsEnabled} onChange={(e) => setSettings({ ...settings, notificationsEnabled: e.target.checked })} />Enable study inbox and external alerts</label>
      {admin && <Button disabled={busy} type="submit">Save study settings</Button>}
    </form>}
  </details>;
}
