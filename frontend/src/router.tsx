import { Suspense, lazy, type ComponentType } from "react";
import { createBrowserRouter } from "react-router";
import { PatientLayout } from "@/components/layout/patient-layout";
import { ProtectedRoute } from "@/components/shared/route-guards";
import { WorkspaceRedirect, PatientRedirect, LoginRedirect } from "@/pages/legacy-redirects";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { ErrorFallback } from "@/components/shared/error-boundary";
import { NotFound } from "@/components/shared/not-found";
function page(load: () => Promise<{ default: ComponentType }>) {
  const Page = lazy(load);
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <Page />
    </Suspense>
  );
}
export const router = createBrowserRouter([
  {
    errorElement: <ErrorFallback />,
    children: [
      { path: "/", element: page(() => import("@/pages/landing")) },
      { path: "/login", element: page(() => import("@/pages/login")) },
      { path: "/demo-login", element: <LoginRedirect /> },
      { path: "/review/:sessionId", element: <PatientRedirect /> },
      { path: "/patient", element: page(() => import("@/pages/patient-access")) },
      { path: "/connected", element: <WorkspaceRedirect /> },
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: "/dashboard",
            element: page(() =>
              import("@/components/layout/dashboard-layout").then((m) => ({
                default: m.DashboardLayout,
              })),
            ),
            children: [
              {
                index: true,
                element: page(() => import("@/pages/dashboard/index")),
              },
              {
                path: "documents",
                element: page(
                  () => import("@/pages/dashboard/documents/index"),
                ),
              },
              {
                path: "documents/:id",
                element: page(() => import("@/pages/dashboard/documents/[id]")),
              },
              {
                path: "sessions",
                element: page(() => import("@/pages/dashboard/sessions/index")),
              },
              {
                path: "sessions/new",
                element: page(() => import("@/pages/dashboard/sessions/new")),
              },
              {
                path: "sessions/:id",
                element: page(
                  () => import("@/pages/dashboard/sessions/[id]/index"),
                ),
              },
              {
                path: "sessions/:id/report",
                element: page(
                  () => import("@/pages/dashboard/sessions/[id]/report"),
                ),
              },
              {
                path: "settings",
                element: page(() => import("@/pages/dashboard/settings")),
              },
            ],
          },
        ],
      },
      {
        path: "/session/:sessionId",
        element: <PatientLayout />,
        children: [
          { index: true, element: page(() => import("@/pages/session/index")) },
          { path: "overview", element: page(() => import("@/pages/session/overview")) },
          { path: "chat", element: page(() => import("@/pages/session/chat")) },
          { path: "voice", element: page(() => import("@/pages/session/chat")) },
          { path: "summary", element: page(() => import("@/pages/session/summary")) },
        ],
      },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
