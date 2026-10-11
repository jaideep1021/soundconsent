import { useState } from "react";
import { Link } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { newSessionSchema } from "@/lib/validators";
import { useSessionStore } from "@/stores/session-store";
import { useDocumentStore } from "@/stores/document-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
export default function NewSessionPage() {
  const documents = useDocumentStore((s) => s.documents);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(newSessionSchema),
    defaultValues: { patientName: "", dateOfBirth: "", documentId: "" },
  });
  return (
    <div className="max-w-2xl space-y-8">
      <Link className="underline" to="/dashboard/sessions">
        Back to Sessions
      </Link>
      <h1 className="text-4xl font-semibold">Create Session</h1>
      {url ? (
        <div className="border rounded-xl p-6 space-y-6">
          <h2 className="text-xl font-semibold">Demo session created</h2>
          <p className="text-muted-foreground">
            Open this link in this tab to test the patient flow. It is not a
            shareable clinical link.
          </p>
          <Input aria-label="Patient session link" value={url} readOnly />
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                } catch {
                  toast.error(
                    "Could not copy. Select and copy the link above.",
                  );
                }
              }}
            >
              {copied ? "Copied" : "Copy Link"}
            </Button>
            <Button asChild variant="outline">
              <Link to={new URL(url).pathname}>Open patient session</Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setUrl("");
                setCopied(false);
                reset();
              }}
            >
              Create Another
            </Button>
          </div>
        </div>
      ) : (
        <form
          noValidate
          className="space-y-6"
          onSubmit={handleSubmit((data) => {
            try {
              const id = useSessionStore.getState().createSession(data);
              setUrl(`${window.location.origin}/session/${id}`);
            } catch (e) {
              setError("root", {
                message:
                  e instanceof Error ? e.message : "Could not create session.",
              });
            }
          })}
        >
          <div className="space-y-2">
            <label htmlFor="patientName">Patient Full Name</label>
            <Input
              id="patientName"
              {...register("patientName")}
              aria-invalid={!!errors.patientName}
              aria-describedby="patientName-error"
            />
            <p id="patientName-error" role="alert" className="text-destructive">
              {errors.patientName?.message}
            </p>
          </div>
          <div className="space-y-2">
            <label htmlFor="dob">Date of Birth</label>
            <Input
              id="dob"
              type="date"
              {...register("dateOfBirth")}
              aria-invalid={!!errors.dateOfBirth}
              aria-describedby="dob-error"
            />
            <p id="dob-error" role="alert" className="text-destructive">
              {errors.dateOfBirth?.message}
            </p>
          </div>
          <div className="space-y-2">
            <label htmlFor="document">Select ICF Document</label>
            <select
              id="document"
              {...register("documentId")}
              aria-invalid={!!errors.documentId}
              aria-describedby="document-error"
              className="w-full h-11 border bg-cream rounded-standard px-3"
            >
              <option value="">Select a document…</option>
              {documents
                .filter((d) => d.status === "Active" && d.sections.length)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
            </select>
            <p id="document-error" role="alert" className="text-destructive">
              {errors.documentId?.message}
            </p>
          </div>
          {errors.root && (
            <p role="alert" className="text-destructive">
              {errors.root.message}
            </p>
          )}
          <Button type="submit" className="w-full">
            Generate Patient Link
          </Button>
        </form>
      )}
    </div>
  );
}
