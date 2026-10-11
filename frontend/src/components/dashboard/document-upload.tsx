import { useRef, useState, type ReactElement } from "react";
import { useNavigate } from "react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { validatePdf } from "@/lib/validators";
import { useDocumentStore } from "@/stores/document-store";
export function DocumentUploadModal({ children }: { children: ReactElement }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const select = (files: FileList | null) => {
    setFile(null);
    setError("");
    if (!files?.length) return;
    if (files.length !== 1) {
      setError("Choose one PDF at a time.");
      return;
    }
    const selected = files[0];
    const problem = validatePdf(selected);
    if (problem) setError(problem);
    else setFile(selected);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        setFile(null);
        setError("");
        setDragging(false);
      }}
    >
      <DialogTrigger render={children} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add ICF Document</DialogTitle>
          <DialogDescription>
            Select a PDF to create a local draft. File transfer and AI
            extraction are unavailable in this demo.
          </DialogDescription>
        </DialogHeader>
        <input
          ref={input}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          tabIndex={-1}
          aria-label="Select PDF"
          onChange={(e) => {
            select(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            select(e.dataTransfer.files);
          }}
          className={`min-h-40 border-2 border-dashed rounded-xl p-8 focus-visible:ring-2 focus-visible:ring-ring ${dragging ? "border-charcoal bg-muted" : "border-border-interactive"}`}
        >
          <span className="block font-semibold">
            Choose a PDF or drop it here
          </span>
          <span className="text-sm text-muted-foreground">
            PDF · Maximum 10 MB
          </span>
        </button>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {file && (
          <p role="status" className="break-all">
            {file.name} · {(file.size / 1024).toFixed(1)} KB
          </p>
        )}
        <Button
          disabled={!file}
          onClick={() => {
            if (!file) return;
            const id = crypto.randomUUID();
            useDocumentStore
              .getState()
              .save({
                id,
                title: file.name.replace(/\.pdf$/i, ""),
                source: file.name,
                status: "Draft",
                sections: [],
              });
            setOpen(false);
            navigate(`/dashboard/documents/${id}`);
          }}
        >
          Create Local Draft
        </Button>
      </DialogContent>
    </Dialog>
  );
}
