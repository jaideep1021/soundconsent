import { useState } from "react";
import { useSessionStore } from "@/stores/session-store";
import { ConsentSignature } from "@/components/patient/consent-signature";
import { CheckCircle2, AlertTriangle } from "lucide-react";
export default function SessionSummaryPage() {
  const { session, completeSession } = useSessionStore();
  const [error, setError] = useState("");
  if (!session) return null;
  if (session.status === "completed")
    return (
      <div className="py-12 space-y-6 text-center">
        <CheckCircle2 className="w-12 h-12 mx-auto" />
        <h1 className="text-4xl font-semibold">Thank You</h1>
        <p>
          Your demo signature for {session.procedureName} was saved in this
          browser tab. Nothing was submitted to your care team.
        </p>
        <p className="text-sm text-muted-foreground">
          Signed by {session.signature?.name} ·{" "}
          {session.signature &&
            new Date(session.signature.signedAt).toLocaleString()}
        </p>
      </div>
    );
  return (
    <div className="space-y-8 pb-10">
      <h1 className="text-4xl font-semibold">Review & Consent</h1>
      <p className="text-muted-foreground">
        Review your recorded responses for {session.procedureName}. This demo
        does not assess understanding or record clinical consent.
      </p>
      {session.sections.map((section) => (
        <div key={section.id} className="border rounded-xl p-5 space-y-2">
          <h2 className="font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            {section.title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {section.aiAssessment ||
              "Not evaluated. Discuss this section with your care team."}
          </p>
          <p className="whitespace-pre-wrap">
            {section.patientResponse || "No response recorded."}
          </p>
        </div>
      ))}
      <p className="text-muted-foreground">
        Unanswered questions remain for your care team. A demo signature does
        not clear items needing review.
      </p>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <ConsentSignature
        patientName={session.patientName}
        onConsent={(signature) => {
          if (!completeSession(signature))
            setError(
              "Please complete each section and check your signature before submitting.",
            );
        }}
      />
    </div>
  );
}
