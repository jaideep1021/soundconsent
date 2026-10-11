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
import { backendApi } from "@/lib/backend-api";
import { apiError } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";
import { Input } from "@/components/ui/input";
export function DocumentUploadModal({ children }: { children: ReactElement }) {
  const [busy, setBusy] = useState(false);
  const [studyId, setStudyId] = useState("");
  const [version, setVersion] = useState("");
  const submitting = useRef(false);
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
        if (submitting.current) return;
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
            Upload an approved consent PDF to extract its sections and prepare understanding reviews.
          </DialogDescription>
        </DialogHeader>
        <label className="block" htmlFor="upload-study">Study ID</label><Input id="upload-study" required pattern="[A-Za-z0-9._-]{1,100}" disabled={busy} value={studyId} onChange={(e) => setStudyId(e.target.value)} />
        <label className="block" htmlFor="upload-version">Expected version (optional)</label><Input id="upload-version" disabled={busy} value={version} onChange={(e) => setVersion(e.target.value)} />
        <input
          disabled={busy}
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
          disabled={busy}
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!busy) select(e.dataTransfer.files);
          }}
          className={`min-h-40 border-2 border-dashed rounded-xl p-8 focus-visible:ring-2 focus-visible:ring-ring ${dragging ? "border-charcoal bg-muted" : "border-border-interactive"}`}
        >
          <span className="block font-semibold">
            Choose a PDF or drop it here
          </span>
          <span className="text-sm text-muted-foreground">
            PDF · Maximum 20 MiB
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
        {busy && <p role="status">Processing document…</p>}
        <Button disabled={busy || !file || !studyId.trim()} onClick={async () => {
          if (!file || submitting.current) return;
          submitting.current = true; setBusy(true); setError("");
          try {
            const document = await backendApi.upload(file, studyId, version);
            await queryClient.invalidateQueries({ queryKey: ["coordinator"] });
            setOpen(false); setFile(null);
            navigate(`/dashboard/documents/${encodeURIComponent(document.id)}`);
          } catch (error) { setError(apiError(error)); }
          finally { submitting.current = false; setBusy(false); }
        }}>Upload and process PDF</Button>
      </DialogContent>
    </Dialog>
  );
}
