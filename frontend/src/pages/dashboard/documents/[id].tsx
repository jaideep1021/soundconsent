import { useState } from "react";
import { Link, useParams } from "react-router";
import { useDocumentStore } from "@/stores/document-store";
import type { ConsentDocument } from "@/data/demo-documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NotFound } from "@/components/shared/not-found";
import { toast } from "sonner";
function DocumentEditor({ document }: { document: ConsentDocument }) {
  const [draft, setDraft] = useState(() => structuredClone(document));
  const [error, setError] = useState("");
  const updateSection = (
    id: string,
    field: "title" | "content",
    value: string,
  ) =>
    setDraft((d) => ({
      ...d,
      sections: d.sections.map((s) =>
        s.id === id ? { ...s, [field]: value } : s,
      ),
    }));
  const move = (index: number, offset: number) =>
    setDraft((d) => {
      const sections = [...d.sections];
      [sections[index], sections[index + offset]] = [
        sections[index + offset],
        sections[index],
      ];
      return { ...d, sections };
    });
  return (
    <div className="space-y-8 max-w-4xl">
      <Link className="underline" to="/dashboard/documents">
        Back to Documents
      </Link>
      <h1 className="text-4xl font-semibold">Edit Document</h1>
      <p className="text-muted-foreground break-all">
        Source: {document.source}
      </p>
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (
            !draft.title.trim() ||
            draft.sections.some((s) => !s.title.trim() || !s.content.trim()) ||
            (draft.status === "Active" && !draft.sections.length)
          ) {
            setError(
              "Enter a document title and a title and content for each section. Active documents need at least one section.",
            );
            return;
          }
          useDocumentStore
            .getState()
            .save({ ...draft, title: draft.title.trim() });
          setError("");
          toast.success("Document saved in this tab.");
        }}
      >
        <div className="space-y-2">
          <label htmlFor="document-title">Document title</label>
          <Input
            id="document-title"
            maxLength={160}
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="document-status">Status</label>
          <select
            id="document-status"
            className="block h-11 border rounded-standard bg-cream px-3"
            value={draft.status}
            onChange={(e) =>
              setDraft({
                ...draft,
                status: e.target.value as ConsentDocument["status"],
              })
            }
          >
            {["Active", "Draft", "Archived"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <h2 className="text-xl font-semibold">Sections</h2>
        {!draft.sections.length && (
          <p className="text-muted-foreground">
            No sections yet. Add content manually; PDF extraction is not
            connected.
          </p>
        )}
        {draft.sections.map((section, index) => (
          <details key={section.id} className="border rounded-xl p-4" open>
            <summary className="min-h-11 cursor-pointer font-semibold">
              {index + 1}. {section.title || "Untitled section"}
            </summary>
            <div className="space-y-3 pt-3">
              <label className="block" htmlFor={`title-${section.id}`}>
                Section title
              </label>
              <Input
                id={`title-${section.id}`}
                value={section.title}
                onChange={(e) =>
                  updateSection(section.id, "title", e.target.value)
                }
              />
              <label className="block" htmlFor={`content-${section.id}`}>
                Content
              </label>
              <textarea
                id={`content-${section.id}`}
                className="w-full min-h-32 border bg-cream rounded-standard p-3 focus-visible:ring-2 focus-visible:ring-ring"
                value={section.content}
                onChange={(e) =>
                  updateSection(section.id, "content", e.target.value)
                }
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={index === 0}
                  aria-label={`Move ${section.title} up`}
                  onClick={() => move(index, -1)}
                >
                  Move up
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={index === draft.sections.length - 1}
                  aria-label={`Move ${section.title} down`}
                  onClick={() => move(index, 1)}
                >
                  Move down
                </Button>
              </div>
            </div>
          </details>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setDraft((d) => ({
              ...d,
              sections: [
                ...d.sections,
                { id: crypto.randomUUID(), title: "", content: "" },
              ],
            }))
          }
        >
          Add Section
        </Button>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        <div>
          <Button type="submit">Save Changes</Button>
        </div>
      </form>
    </div>
  );
}
export default function DocumentDetail() {
  const { id } = useParams();
  const document = useDocumentStore((s) =>
    s.documents.find((d) => d.id === id),
  );
  return document ? (
    <DocumentEditor key={document.id} document={document} />
  ) : (
    <NotFound title="Document not found" />
  );
}
