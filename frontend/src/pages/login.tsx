import { Navigate, useLocation, useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@/lib/validators";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const authenticated = useAuthStore((s) => s.isAuthenticated);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  if (authenticated) return <Navigate to="/dashboard" replace />;
  return (
    <main className="min-h-dvh flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-3xl">Welcome back</CardTitle>
          <p className="text-muted-foreground">
            Frontend demo: enter a sample email and any demo password. No
            account authentication is performed.
          </p>
        </CardHeader>
        <CardContent>
          <form
            noValidate
            className="space-y-6"
            onSubmit={handleSubmit((data) => {
              useAuthStore
                .getState()
                .login("demo-token", {
                  id: "demo",
                  name: "Demo Coordinator",
                  email: data.email,
                  role: "coordinator",
                });
              const from = location.state?.from;
              navigate(
                typeof from === "string" &&
                  (from === "/dashboard" || from.startsWith("/dashboard/"))
                  ? from
                  : "/dashboard",
                { replace: true },
              );
            })}
          >
            <div className="space-y-2">
              <label htmlFor="email">Email</label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                {...register("email")}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
              />
              {errors.email && (
                <p id="email-error" role="alert" className="text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label htmlFor="password">Demo password</label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register("password")}
                aria-invalid={!!errors.password}
                aria-describedby={
                  errors.password ? "password-error" : undefined
                }
              />
              {errors.password && (
                <p
                  id="password-error"
                  role="alert"
                  className="text-destructive"
                >
                  {errors.password.message}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full">
              Log in
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
