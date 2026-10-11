import { describe, expect, it } from "vitest";
import { validatePdf } from "../src/lib/validators";
import { coordinatorDestination, legacyWorkspaceDestination } from "../src/lib/navigation";
describe("navigation safety and saved links", () => {
  it("retains authorized deep links and rejects external or unrelated destinations", () => {
    expect(coordinatorDestination("/dashboard/sessions/abc/report")).toBe("/dashboard/sessions/abc/report");
    for (const value of [undefined, "https://evil.example", "//evil.example", "/dashboard-evil", "/session/abc"])
      expect(coordinatorDestination(value)).toBe("/dashboard");
  });
  it("maps old workspace links to the saved session without interpreting the ID as a path", () => {
    expect(legacyWorkspaceDestination("?session=abc")).toBe("/dashboard/sessions/abc");
    expect(legacyWorkspaceDestination("?session=a%2Fb")).toBe("/dashboard/sessions/a%2Fb");
    expect(legacyWorkspaceDestination("")).toBe("/dashboard");
  });
});
describe("PDF upload contract", () => {
  it("accepts PDFs through the backend's exact 20 MiB limit", () => {
    expect(validatePdf({ name: "form.PDF", type: "application/pdf", size: 20 * 1024 * 1024 })).toBeNull();
    expect(validatePdf({ name: "form.pdf", type: "", size: 1 })).toBeNull();
  });
  it("rejects incompatible, empty and oversized files before upload", () => {
    for (const file of [
      { name: "form.txt", type: "text/plain", size: 1 },
      { name: "form.pdf", type: "image/png", size: 1 },
      { name: "form.pdf", type: "application/pdf", size: 0 },
      { name: "form.pdf", type: "application/pdf", size: 20 * 1024 * 1024 + 1 },
    ]) expect(validatePdf(file)).toBeTruthy();
  });
});
