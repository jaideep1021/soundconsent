import { useState } from "react";
import { backendApi, type BackendDocument } from "@/lib/backend-api";
import { apiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DocumentManager({ document, admin, onSaved }: { document: BackendDocument; admin: boolean; onSaved: (document: BackendDocument) => Promise<void> }) {
  const [draft, setDraft] = useState(document);
  const [version, setVersion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const run = async (action: () => Promise<BackendDocument>) => {
    if (busy) return; setBusy(true); setError("");
    try { const saved = await action(); setDraft(saved); setDirty(false); await onSaved(saved); }
    catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  };
  return <section className="space-y-4" aria-label="Document management">
    <p>Document state: {draft.lifecycle} · Revision {draft.revision}</p>
    {error && <p role="alert">{error}</p>}
    <p>Published source is immutable. Create a draft version to correct section text or ordering. Existing reviews retain their original source.</p>
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void run(() => backendApi.draft(draft.id, version.trim())); }}>
      <label className="block" htmlFor="new-version">New version</label><Input id="new-version" required maxLength={50} pattern="[A-Za-z0-9._-]+" value={version} disabled={busy} onChange={(e) => setVersion(e.target.value)} />
      <Button disabled={busy || !version.trim()} type="submit">Create draft version</Button>
    </form>
    {draft.lifecycle === "draft" && <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void run(() => backendApi.editDocument(draft)); }}>
      <label className="block" htmlFor="edit-title">Document title</label><Input id="edit-title" required maxLength={300} disabled={busy} value={draft.title} onChange={(e) => { setDirty(true); setDraft({ ...draft, title: e.target.value }); }} />
      {draft.sections.map((section, index) => <fieldset key={section.id} className="border rounded p-3 space-y-3" disabled={busy}>
        <legend>Section {index + 1}</legend>
        <label className="block" htmlFor={`section-title-${index}`}>Section title</label><Input id={`section-title-${index}`} required maxLength={300} value={section.title} onChange={(e) => { setDirty(true); setDraft({ ...draft, sections: draft.sections.map((s, i) => i === index ? { ...s, title: e.target.value } : s) }); }} />
        <label className="block" htmlFor={`section-text-${index}`}>Source text</label><textarea className="w-full min-h-40 border rounded p-3" id={`section-text-${index}`} required maxLength={50000} value={section.text ?? ""} onChange={(e) => { setDirty(true); setDraft({ ...draft, sections: draft.sections.map((s, i) => i === index ? { ...s, text: e.target.value } : s) }); }} />
        <Button type="button" variant="outline" disabled={index === 0} onClick={() => { const sections = [...draft.sections]; [sections[index - 1], sections[index]] = [sections[index], sections[index - 1]]; setDirty(true); setDraft({ ...draft, sections }); }}>Move section up</Button>
        <Button type="button" variant="outline" disabled={draft.sections.length <= 1} onClick={() => { setDirty(true); setDraft({ ...draft, sections: draft.sections.filter((_, i) => i !== index) }); }}>Remove section</Button>
      </fieldset>)}
      <Button type="button" variant="outline" disabled={busy || draft.sections.length >= 100} onClick={() => { setDirty(true); setDraft({ ...draft, sections: [...draft.sections, { id: crypto.randomUUID(), title: "", text: "" }] }); }}>Add section</Button>
      <Button disabled={busy || !dirty} type="submit">Save draft changes</Button>
      <p>Publication requires an administrator to verify the content and a version approved in the server configuration.</p>
      {admin && <Button type="button" disabled={busy || dirty} onClick={() => void run(() => backendApi.documentAction(draft, "publish"))}>Approve content and publish</Button>}
    </form>}
    {draft.lifecycle !== "archived" && <details><summary className="min-h-11 cursor-pointer">Archive this document</summary><p>Archiving prevents new reviews. Existing reviews remain accessible.</p><Button disabled={busy || dirty} variant="outline" onClick={() => void run(() => backendApi.documentAction(draft, "archive"))}>Archive document</Button></details>}
  </section>;
}
