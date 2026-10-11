import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { settingsSchema } from "@/lib/validators";
import { useSettingsStore } from "@/stores/settings-store";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
export default function SettingsPage() {
  const { settings, save } = useSettingsStore();
  const user = useAuthStore((s) => s.user);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(settingsSchema),
    defaultValues: settings,
  });
  return (
    <div className="space-y-8 max-w-3xl">
      <h1 className="text-4xl font-semibold">Settings</h1>
      <p className="text-muted-foreground">
        Preview preferences are saved in this tab. Assessment and voice behavior
        require integration.
      </p>
      <form
        noValidate
        className="space-y-6"
        onSubmit={handleSubmit((data) => {
          save(data);
          toast.success("Demo preferences saved.");
        })}
      >
        <section className="border rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">AI Assessment Strictness</h2>
          <label className="block" htmlFor="strictness">
            Strictness Level
          </label>
          <select
            id="strictness"
            className="w-full h-11 border rounded-standard bg-cream px-3"
            {...register("strictness")}
          >
            <option value="balanced">Balanced</option>
            <option value="strict">Strict</option>
            <option value="lenient">Lenient</option>
          </select>
          <label className="block" htmlFor="retries">
            Retry Attempts Before Flagging
          </label>
          <Input
            id="retries"
            type="number"
            min={1}
            max={5}
            {...register("retries", { valueAsNumber: true })}
            aria-invalid={!!errors.retries}
            aria-describedby="retries-error"
          />
          {errors.retries && (
            <p id="retries-error" role="alert" className="text-destructive">
              Choose a whole number between 1 and 5.
            </p>
          )}
        </section>
        <section className="border rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">Consent Workflow</h2>
          <label
            className="flex min-h-11 items-center justify-between gap-4"
            htmlFor="auto-advance"
          >
            Auto-advance Sections
            <input
              id="auto-advance"
              type="checkbox"
              {...register("autoAdvance")}
              className="size-5"
            />
          </label>
          <label
            className="flex min-h-11 items-center justify-between gap-4"
            htmlFor="verbal"
          >
            Require Verbal Confirmation
            <input
              id="verbal"
              type="checkbox"
              {...register("verbal")}
              className="size-5"
            />
          </label>
        </section>
        <Button type="submit">Save Settings</Button>
      </form>
      <section className="border rounded-xl p-6 space-y-3">
        <h2 className="text-xl font-semibold">Account</h2>
        <p>{user?.email}</p>
        <p className="text-muted-foreground">
          Demo coordinator. Credential changes and coordinator management are
          unavailable in this preview.
        </p>
      </section>
      <section className="border rounded-xl p-6 space-y-3">
        <h2 className="text-xl font-semibold">Notifications</h2>
        <p className="text-muted-foreground">
          Email and SMS alerts are unavailable in this preview.
        </p>
      </section>
    </div>
  );
}
