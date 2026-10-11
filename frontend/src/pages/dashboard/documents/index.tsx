import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { backendApi } from "@/lib/backend-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { QueryState } from "@/components/shared/query-state";
import { DocumentUploadModal } from "@/components/dashboard/document-upload";
export default function DocumentsPage() {
  const query = useQuery({ queryKey: ["coordinator", "documents"], queryFn: backendApi.documents });
  const [search, setSearch] = useState("");
  const filtered = query.data?.filter((d) => `${d.title} ${d.studyId} ${d.version}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <div className="space-y-8">
    <div className="flex flex-wrap justify-between gap-4"><div><h1 className="text-4xl font-semibold">Documents</h1><p className="text-muted-foreground mt-2">Manage your Informed Consent Forms (ICF).</p></div><DocumentUploadModal><Button>Upload Document</Button></DocumentUploadModal></div>
    <div className="flex flex-wrap gap-3"><Input aria-label="Search documents" placeholder="Search documents or studies…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" /><Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>Refresh documents</Button></div>
    <QueryState pending={query.isPending} error={query.error} retry={query.refetch} />
    {filtered?.length === 0 && <p role="status">No documents match your search.</p>}
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">{filtered?.map((doc) => <article key={doc.id} className="border rounded-xl p-6 space-y-4"><Link className="text-xl underline break-words" to={`/dashboard/documents/${encodeURIComponent(doc.id)}`}>{doc.title}</Link><p className="text-sm text-muted-foreground">{doc.studyId} · Version {doc.version} · {doc.sections.length} sections</p><Badge variant={doc.lifecycle === "published" ? "default" : "secondary"}>{doc.lifecycle}</Badge></article>)}</div>
  </div>;
}
