import { Link, useNavigate, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { backendApi } from "@/lib/backend-api";
import { queryClient } from "@/lib/query-client";
import { useCoordinator } from "@/hooks/use-coordinator";
import { DocumentManager } from "@/components/dashboard/document-manager";
import { QueryState } from "@/components/shared/query-state";
import { Button } from "@/components/ui/button";
export default function DocumentDetail() {
  const { id = "" } = useParams();
  const account = useCoordinator();
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ["coordinator", "document", id], queryFn: () => backendApi.document(id) });
  return <div className="max-w-4xl space-y-6">
    <Link className="underline" to="/dashboard/documents">Back to Documents</Link>
    <QueryState pending={query.isPending} error={query.error} retry={query.refetch} />
    {query.data && <>
      <h1 className="text-4xl font-semibold">{query.data.title}</h1><p>{query.data.studyId} · Version {query.data.version} · {query.data.pageCount} pages</p>
      {query.data.lifecycle === "published" && <Button asChild><Link to={`/dashboard/sessions/new?document=${encodeURIComponent(id)}`}>Start review</Link></Button>}
      <DocumentManager key={`${id}:${query.data.revision}`} document={query.data} admin={account.data?.role === "admin"} onSaved={async (document) => {
        await queryClient.invalidateQueries({ queryKey: ["coordinator"] });
        queryClient.setQueryData(["coordinator", "document", document.id], document);
        if (document.id !== id) navigate(`/dashboard/documents/${encodeURIComponent(document.id)}`);
      }} />
      {query.data.lifecycle !== "draft" && <section className="space-y-3"><h2 className="text-2xl font-semibold">Source sections</h2>{query.data.sections.map((s) => <details className="border rounded-xl p-4" key={s.id}><summary className="min-h-11 cursor-pointer">{s.title}</summary><p className="whitespace-pre-wrap">{s.text}</p></details>)}</section>}
    </>}
  </div>;
}
