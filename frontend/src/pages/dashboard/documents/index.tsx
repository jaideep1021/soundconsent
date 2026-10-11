import { useState } from "react";
import { Link } from "react-router";
import { useDocumentStore } from "@/stores/document-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DocumentUploadModal } from "@/components/dashboard/document-upload";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
export default function DocumentsPage() {
  const { documents, save, duplicate } = useDocumentStore();
  const [search, setSearch] = useState("");
  const filtered = documents.filter((d) =>
    d.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold">Documents</h1>
          <p className="text-muted-foreground mt-2">
            Manage your Informed Consent Forms (ICF).
          </p>
        </div>
        <DocumentUploadModal>
          <Button>Upload Document</Button>
        </DocumentUploadModal>
      </div>
      <Input
        aria-label="Search documents"
        placeholder="Search documents…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />
      {!filtered.length && <p role="status">No documents match your search.</p>}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map((doc) => (
          <article key={doc.id} className="border rounded-xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <Link
                className="text-xl underline decoration-transparent hover:decoration-current focus-visible:decoration-current"
                to={`/dashboard/documents/${doc.id}`}
              >
                {doc.title}
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={`Options for ${doc.title}`}
                  className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-standard hover:bg-muted"
                >
                  <MoreVertical className="w-5 h-5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => duplicate(doc.id)}>
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      save({
                        ...doc,
                        status:
                          doc.status === "Archived" ? "Draft" : "Archived",
                      })
                    }
                  >
                    {doc.status === "Archived" ? "Restore Draft" : "Archive"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <p className="text-sm text-muted-foreground">
              {doc.sections.length} sections
            </p>
            <Badge variant={doc.status === "Active" ? "default" : "secondary"}>
              {doc.status}
            </Badge>
          </article>
        ))}
      </div>
    </div>
  );
}
