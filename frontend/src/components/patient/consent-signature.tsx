import { useState, type FormEvent } from "react";
import { normalizeName } from "@/lib/validators";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
export function ConsentSignature({
  patientName,
  onConsent,
}: {
  patientName: string;
  onConsent: (signature: string) => void;
}) {
  const [agreed, setAgreed] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [error, setError] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (normalizeName(typedName) !== normalizeName(patientName)) {
      setError(
        `Please enter ${patientName}. Capitalization and extra spaces do not matter. Contact your care team if the name is incorrect.`,
      );
      return;
    }
    if (!agreed) {
      setError("Please check the acknowledgment before signing.");
      return;
    }
    setError("");
    onConsent(typedName);
  };
  return (
    <div className="bg-off-white border rounded-xl p-6 space-y-6">
      <h2 className="text-lg font-semibold">Demo Digital Consent</h2>
      <form onSubmit={submit} className="space-y-6">
        <label className="flex min-h-11 items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="w-5 h-5 mt-1 shrink-0 accent-charcoal"
          />
          <span>
            I acknowledge this is a demonstration. My responses and signature
            are saved only in this browser tab.
          </span>
        </label>
        <div className="space-y-2">
          <label htmlFor="signature">
            Type your full name to sign ({patientName})
          </label>
          <Input
            id="signature"
            autoComplete="name"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            aria-describedby="signature-help signature-error"
            aria-invalid={!!error}
          />
          <p id="signature-help" className="text-sm text-muted-foreground">
            Use the name shown above. Capitalization and extra spaces do not
            matter.
          </p>
        </div>
        <p
          id="signature-error"
          role="alert"
          className="text-sm text-destructive"
        >
          {error}
        </p>
        <Button type="submit" className="w-full">
          Save Demo Signature
        </Button>
      </form>
    </div>
  );
}
