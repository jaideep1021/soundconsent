import { useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { identitySchema } from "@/lib/validators";
import { useSessionStore } from "@/stores/session-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export default function IdentityVerificationPage() {
  const { session, verifyIdentity } = useSessionStore();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(identitySchema),
    defaultValues: { patientName: "", dateOfBirth: "" },
  });
  if (!session) return null;
  return (
    <div className="w-full max-w-md mx-auto py-8 space-y-6">
      <h1 className="text-3xl font-semibold">Welcome</h1>
      <p className="text-muted-foreground">
        Please confirm your identity to review your consent documents.
      </p>
      <form
        noValidate
        className="space-y-6"
        onSubmit={handleSubmit((data) => {
          if (verifyIdentity(data.patientName, data.dateOfBirth))
            navigate(`/session/${session.id}/overview`);
          else
            setError("root", {
              message:
                "We couldn't verify your details. Please check your name and date of birth, or contact your care team.",
            });
        })}
      >
        <div className="space-y-2">
          <label htmlFor="name">Full Name</label>
          <Input
            id="name"
            autoComplete="name"
            {...register("patientName")}
            aria-invalid={!!errors.patientName}
            aria-describedby={errors.patientName ? "name-error" : undefined}
          />
          {errors.patientName && (
            <p id="name-error" role="alert" className="text-destructive">
              {errors.patientName.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <label htmlFor="dob">Date of Birth</label>
          <Input
            id="dob"
            type="date"
            autoComplete="bday"
            {...register("dateOfBirth")}
            aria-invalid={!!errors.dateOfBirth}
            aria-describedby={errors.dateOfBirth ? "dob-error" : undefined}
          />
          {errors.dateOfBirth && (
            <p id="dob-error" role="alert" className="text-destructive">
              {errors.dateOfBirth.message}
            </p>
          )}
        </div>
        {errors.root && (
          <p role="alert" className="text-destructive">
            {errors.root.message}
          </p>
        )}
        <Button type="submit" className="w-full">
          Continue
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">
        Having trouble? Contact your care team.
      </p>
    </div>
  );
}
