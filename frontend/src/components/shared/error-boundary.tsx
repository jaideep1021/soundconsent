import { Component, type ReactNode } from "react";
export function ErrorFallback() {
  return (
    <div role="alert" className="p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p>Please reload this page and try again.</p>
      <a href="/" className="underline">
        Return home
      </a>
    </div>
  );
}
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <ErrorFallback /> : this.props.children;
  }
}
