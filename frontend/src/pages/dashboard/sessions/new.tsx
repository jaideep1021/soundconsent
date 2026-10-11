import { useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { backendApi, newMutation } from "@/lib/backend-api";
import { apiError } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";
import { QueryState } from "@/components/shared/query-state";
import { Button } from "@/components/ui/button";
export default function NewSessionPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ["coordinator", "documents"], queryFn: backendApi.documents });
  const [documentId, setDocumentId] = useState(params.get("document") ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef({ documentId: "", mutation: newMutation() });
  const lock = useRef(false);
  const published = query.data?.filter((d) => d.lifecycle === "published") ?? [];
  return <div className="max-w-2xl space-y-8">
    <Link className="underline" to="/dashboard/sessions">Back to Sessions</Link><h1 className="text-4xl font-semibold">Create Session</h1>
    <p className="text-muted-foreground">Choose an approved document. After creating the review, invite the participant with a private link and separate access code.</p>
    <QueryState pending={query.isPending} error={query.error} retry={query.refetch} />
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {query.data && <form className="space-y-5" onSubmit={async (e) => {
      e.preventDefault(); if (lock.current) return; lock.current = true; setBusy(true); setError("");
      try {
        if (request.current.documentId !== documentId) request.current = { documentId, mutation: newMutation() };
        const session = await backendApi.start(documentId, request.current.mutation);
        await queryClient.invalidateQueries({ queryKey: ["coordinator"] });
        navigate(`/dashboard/sessions/${encodeURIComponent(session.sessionId)}`);
      } catch (err) { setError(apiError(err)); } finally { lock.current = false; setBusy(false); }
    }}>
      <label className="block" htmlFor="session-document">Select ICF Document</label>
      <select id="session-document" required disabled={busy} value={documentId} onChange={(e) => setDocumentId(e.target.value)} className="w-full h-11 border bg-cream rounded-standard px-3"><option value="">Select a published document…</option>{published.map((d) => <option key={d.id} value={d.id}>{d.title} · {d.studyId} · Version {d.version}</option>)}</select>
      {!published.length && <p>No published documents are available. <Link className="underline" to="/dashboard/documents">Upload a document</Link> first.</p>}
      {busy && <p role="status">Preparing the review…</p>}
      <Button disabled={busy || !published.some((d) => d.id === documentId)} type="submit">Create session</Button>
    </form>}
  </div>;
}
