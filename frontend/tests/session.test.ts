import { beforeEach, describe, expect, it } from "vitest";
import { useSessionStore } from "../src/stores/session-store";
import { demoSessions } from "../src/data/demo-sessions";
import { useDocumentStore } from "../src/stores/document-store";
import { demoDocuments } from "../src/data/demo-documents";
import { identitySchema, validatePdf } from "../src/lib/validators";
beforeEach(() => {
  sessionStorage.clear();
  useSessionStore.setState({
    records: structuredClone(demoSessions),
    session: null,
    verifiedSessionId: null,
    error: null,
  });
  useDocumentStore.setState({ documents: structuredClone(demoDocuments) });
});
const store = () => useSessionStore.getState();
const verify = () => {
  store().initializeSession("mock-session-1");
  expect(store().verifyIdentity("  JANE   doe ", "1980-05-15")).toBe(true);
  store().startReview();
};
describe("patient lifecycle", () => {
  it("rejects unknown links and clears verification when switching patients", () => {
    verify();
    store().initializeSession("missing");
    expect(store().session).toBeNull();
    expect(store().verifiedSessionId).toBeNull();
    expect(store().error).toBeTruthy();
    store().initializeSession("2");
    expect(store().session?.patientName).toBe("John Smith");
    expect(store().verifyIdentity("Jane Doe", "1980-05-15")).toBe(false);
  });
  it("requires verification and explicit advancement; never passes an arbitrary answer", () => {
    store().initializeSession("mock-session-1");
    store().startReview();
    expect(store().session?.sections[0].status).toBe("pending");
    verify();
    store().advanceSection();
    expect(store().session?.sections[0].status).toBe("active");
    store().addMessage({
      role: "patient",
      content: "I'm confused. Could you explain?",
    });
    expect(store().session?.sections[0].status).toBe("active");
    store().advanceSection();
    expect(store().session?.sections[0].status).toBe("needs-review");
    expect(store().session?.sections[1].status).toBe("active");
  });
  it("blocks premature/mismatched signatures and retains signature, transcript and review flags through hydration", async () => {
    verify();
    expect(store().completeSession("Jane Doe")).toBe(false);
    for (let i = 0; i < 4; i++) {
      store().addMessage({ role: "patient", content: `Question ${i}` });
      store().advanceSection();
    }
    expect(store().completeSession("Someone Else")).toBe(false);
    expect(store().completeSession(" jane   DOE ")).toBe(true);
    await useSessionStore.persist.rehydrate();
    expect(store().session?.signature?.name).toBe("jane DOE");
    expect(store().session?.signature?.signedAt).toBeTruthy();
    expect(store().session?.flagged).toBe(true);
    expect(store().session?.messages).toHaveLength(4);
    store().addMessage({ role: "patient", content: "late message" });
    expect(store().session?.messages).toHaveLength(4);
  });
  it("creates a matching session from the edited document and rejects archived documents", () => {
    const id = store().createSession({
      patientName: "Sam Example",
      dateOfBirth: "1990-03-12",
      documentId: "2",
    });
    store().initializeSession(id);
    expect(store().session?.procedureName).toBe("Cataract Surgery");
    expect(store().verifyIdentity("Sam Example", "1990-03-12")).toBe(true);
    expect(() =>
      store().createSession({
        patientName: "Sam Example",
        dateOfBirth: "1990-03-12",
        documentId: "4",
      }),
    ).toThrow();
  });
  it("clearing report flag does not change clinical section assessments", () => {
    const before = store().records.find((s) => s.id === "1")!.sections;
    store().updateRecord("1", {
      flagged: false,
      acknowledgedAt: new Date().toISOString(),
    });
    expect(store().records.find((s) => s.id === "1")!.sections).toEqual(before);
  });
});
describe("validation", () => {
  it("rejects impossible, future, and missing identity values", () => {
    for (const dob of ["2023-02-29", "2999-01-01", "", "2020-13-01"])
      expect(
        identitySchema.safeParse({ patientName: "Jane Doe", dateOfBirth: dob })
          .success,
      ).toBe(false);
    expect(
      identitySchema.safeParse({ patientName: "  ", dateOfBirth: "1980-05-15" })
        .success,
    ).toBe(false);
  });
  it("validates PDF type, extension, empty files and exact size boundary", () => {
    expect(
      validatePdf({
        name: "form.PDF",
        type: "application/pdf",
        size: 10 * 1024 * 1024,
      }),
    ).toBeNull();
    expect(validatePdf({ name: "form.pdf", type: "", size: 1 })).toBeNull();
    for (const file of [
      { name: "form.txt", type: "text/plain", size: 1 },
      { name: "form.pdf", type: "image/png", size: 1 },
      { name: "form.pdf", type: "application/pdf", size: 0 },
      { name: "form.pdf", type: "application/pdf", size: 10 * 1024 * 1024 + 1 },
    ])
      expect(validatePdf(file)).toBeTruthy();
  });
});
