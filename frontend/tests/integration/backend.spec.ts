import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

async function open(page: Page) {
  await page.goto("/connected");
  await page.getByLabel("Email", { exact: true }).fill("coordinator@example.com");
  await page.getByLabel("Password", { exact: true }).fill("integration-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
}
async function start(page: Page) {
  await open(page);
  await page.goto("/dashboard/sessions/new?document=integration-document");
  await page.getByRole("button", { name: "Create session", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Section 1 of 2: Purpose" })).toBeVisible();
}

test("real backend: authentication, multipart PDF processing and version errors", async ({ page }) => {
  await page.goto("/connected");
  await page.getByLabel("Email", { exact: true }).fill("coordinator@example.com");
  await page.getByLabel("Password", { exact: true }).fill("invalid");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Email or password is incorrect");
  await page.getByLabel("Password", { exact: true }).fill("integration-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Upload Document", exact: true }).click();
  await page.getByLabel("Study ID", { exact: true }).fill("fixture-study");
  await page.getByLabel("Select PDF").setInputFiles(path.resolve("../sample_icfs/NCT01823991_ICF_001.pdf"));
  await page.getByLabel("Expected version").fill("999");
  await page.getByRole("button", { name: "Upload and process PDF" }).click();
  await expect(page.getByRole("alert")).toContainText("does not match PDF version 10");
  await page.getByLabel("Expected version").fill("10");
  await page.getByRole("button", { name: "Upload and process PDF" }).click();
  await expect(page).toHaveURL(/dashboard\/documents\/[^/]+$/);
  await expect(page.getByText(/Version 10 · 13 pages/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Document management" })).toContainText("published");
});

test("real backend: questions, re-explanation, flagging, completion, report and reload", async ({ page }) => {
  const patientHeaders: Array<string | undefined> = [];
  page.on("request", (request) => {
    if (/\/(questions|responses)$/.test(request.url())) patientHeaders.push(request.headers().authorization);
  });
  await start(page);
  await expect(page.getByRole("log")).toContainText("I am an automated assistant, not a doctor");
  await page.getByLabel("Message type").selectOption("question");
  await page.getByLabel("Your question").fill("When are visits?");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.getByRole("log")).toContainText("Sources: Purpose");
  await expect(page.getByRole("heading", { name: "Section 1 of 2: Purpose" })).toBeVisible();
  await page.getByLabel("Your question").fill("I need a human");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.getByRole("status").filter({ hasText: "saved for clinical follow-up" })).toBeVisible();
  await page.getByLabel("Message type").selectOption("response");
  await page.getByLabel("Your teach-back response").fill("unsure");
  await page.getByRole("button", { name: "Send response" }).click();
  await expect(page.getByRole("log")).toContainText("Let's review this section another way");
  await expect(page.getByRole("heading", { name: "Section 1 of 2: Purpose" })).toBeVisible();
  await page.getByLabel("Your teach-back response").fill("still unsure");
  await page.getByRole("button", { name: "Send response" }).click();
  await expect(page.getByRole("heading", { name: "Section 2 of 2: Risks" })).toBeVisible();
  await page.getByLabel("Your teach-back response").fill("understood: participation is voluntary; email test@example.com");
  await page.getByRole("button", { name: "Send response" }).click();
  await expect(page.getByRole("heading", { name: "Review completed", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send response" })).toHaveCount(0);
  await page.getByRole("link", { name: "View Report", exact: true }).click();
  const report = page.getByRole("region", { name: "Understanding report" });
  await expect(report).toContainText("Needs human follow-up");
  await expect(report).toContainText("Risks — Passed");
  await expect(report).toContainText("I need a human");
  await expect(report).toContainText("[REDACTED_EMAIL]");
  const id = new URL(page.url()).pathname.split("/")[3];
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download report" }).click();
  expect((await download).suggestedFilename()).toBe(`understanding-report-${id}.json`);
  expect(patientHeaders).toHaveLength(5);
  expect(patientHeaders.every((header) => header === undefined)).toBe(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Session report", exact: true })).toBeVisible();
  await expect(report).toContainText("Review completed");
});

test("real backend: recorded response and provider-unavailable recovery", async ({ page }) => {
  await start(page);
  await page.getByRole("button", { name: "Start voice conversation" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send response" })).toBeDisabled(); // Empty input, not a stuck request.
  await page.getByLabel("Or submit a recorded").setInputFiles({ name: "sample.wav", mimeType: "audio/wav", buffer: Buffer.from("test fixture audio") });
  await expect(page.getByRole("heading", { name: "Section 2 of 2: Risks" })).toBeVisible();
  await page.getByRole("button", { name: "Listen to latest assistant response" }).click();
  await expect(page.getByRole("alert")).toHaveText("ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID are required");
  await page.getByLabel("Your teach-back response").fill("understood: visits may cause discomfort");
  await page.getByRole("button", { name: "Send response" }).click();
  await expect(page.getByRole("heading", { name: "Review completed", exact: true })).toBeVisible();
});

test("dashboard is accessible on mobile and unknown IDs remain recoverable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto("/dashboard/documents/missing");
  await expect(page.getByRole("alert")).toContainText("Consent document not found");
  await page.getByRole("link", { name: "Back to Documents" }).click();
  await expect(page.getByRole("heading", { name: "Documents", exact: true })).toBeVisible();
});

test("patient invitation redemption, cross-browser resume, single use and access revocation", async ({ page, browser }) => {
  await start(page);
  const id = new URL(page.url()).pathname.split("/")[3];
  await page.getByRole("button", { name: "Create patient invitation" }).click();
  const invitation = await page.getByLabel("Patient invitation link").inputValue();
  const code = await page.getByLabel("Patient access code").inputValue();
  const context = await browser.newContext();
  const patient = await context.newPage();
  try {
    const denied = await context.request.get(`http://127.0.0.1:4174/api/sessions/${id}`);
    expect(denied.status()).toBe(401);
    await patient.goto(invitation);
    await expect(patient).toHaveURL(new RegExp(`/session/${id}$`));
    await patient.getByLabel("Access code", { exact: true }).fill("wrong");
    await patient.getByRole("button", { name: "Open review", exact: true }).click();
    await expect(patient.getByRole("alert")).toHaveText("Invitation or access code is invalid or expired");
    await patient.getByLabel("Access code", { exact: true }).fill(code);
    await patient.getByRole("button", { name: "Open review", exact: true }).click();
    await expect(patient.getByRole("heading", { name: "Your understanding review" })).toBeVisible();
    await patient.getByRole("link", { name: "Text Chat", exact: true }).click();
    await expect(patient.getByRole("heading", { name: "Section 1 of 2: Purpose" })).toBeVisible();
    expect(await patient.evaluate(() => document.cookie)).not.toContain("sc_review_");
    const cookie = (await context.cookies()).find((c) => c.name.startsWith("sc_review_"));
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Strict");
    expect((await context.request.get("http://127.0.0.1:4174/api/documents")).status()).toBe(401);
    await patient.getByLabel("Your teach-back response").fill("unsure; contact person@example.com");
    await patient.getByRole("button", { name: "Send response" }).click();
    await expect(patient.getByText("Attempts on current section: 1")).toBeVisible();
    await patient.reload();
    await expect(patient.getByText("Attempts on current section: 1")).toBeVisible();
    await expect(patient.getByRole("log")).toContainText("[REDACTED_EMAIL]");
    await expect(patient.getByRole("log")).toContainText("Let's review this section another way");
    const replay = await context.request.post(`http://127.0.0.1:4174/api/sessions/${id}/access`, { data: { invitationToken: new URLSearchParams(new URL(invitation).hash.slice(1)).get("invite"), accessCode: code } });
    expect(replay.status()).toBe(401);
    await page.reload();
    await expect(page.getByText("Attempts on current section: 1")).toBeVisible();
    await page.getByRole("button", { name: "Revoke patient access" }).click();
    await expect(page.getByText("Patient access and outstanding invitations revoked.", { exact: true })).toBeVisible();
    await patient.getByRole("button", { name: "Refresh review", exact: true }).click();
    await expect(patient.getByRole("alert")).toContainText("expired or was revoked");
    await expect(patient.getByRole("log")).toHaveCount(0);
  } finally { await context.close(); }
});

test("coordinator saved records, source text, resume and server logout", async ({ page }) => {
  await start(page);
  const id = new URL(page.url()).pathname.split("/")[3];
  await page.getByLabel("Your teach-back response").fill("understood: monthly visits");
  await page.getByRole("button", { name: "Send response" }).click();
  await expect(page.getByRole("heading", { name: "Section 2 of 2: Risks" })).toBeVisible();
  await page.goto("/dashboard/documents/integration-document");
  await page.getByText("Purpose", { exact: true }).click();
  await expect(page.getByText("This study examines monthly study visits.", { exact: true })).toBeVisible();
  await page.goto("/dashboard/sessions");
  await page.getByLabel("Search sessions").fill(id);
  await page.getByRole("link", { name: `View session ${id}`, exact: true }).click();
  await expect(page.getByRole("heading", { name: "Section 2 of 2: Risks" })).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  expect((await page.request.get("/api/sessions")).status()).toBe(401);
  await page.reload();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
});

test("document draft editing, publication, archive and settings persist through browser reload", async ({ page }) => {
  await open(page);
  await page.goto("/dashboard/documents/integration-document");
  const manager = page.getByRole("region", { name: "Document management" });
  await manager.getByLabel("New version", { exact: true }).fill("11");
  await manager.getByRole("button", { name: "Create draft version" }).click();
  await expect(manager).toContainText("Document state: draft");
  await manager.getByLabel("Document title", { exact: true }).fill("Revised integration consent");
  await manager.getByLabel("Source text", { exact: true }).first().fill("Updated approved purpose text.");
  await manager.getByRole("button", { name: "Save draft changes" }).click();
  await expect(manager).toContainText("Revision 1");
  await manager.getByRole("button", { name: "Approve content and publish" }).click();
  await expect(manager).toContainText("Document state: published");
  const id = new URL(page.url()).pathname.split("/")[3];
  await page.reload();
  await expect(manager).toContainText("Document state: published");
  await manager.getByText("Archive this document", { exact: true }).click();
  await manager.getByRole("button", { name: "Archive document", exact: true }).click();
  await expect(manager).toContainText("Document state: archived");
  await expect(page.getByRole("link", { name: "Start review", exact: true })).toHaveCount(0);
  await page.goto(`/dashboard/sessions/new?document=${id}`);
  await expect(page.getByRole("option", { name: /Revised integration consent/ })).toHaveCount(0);
  await page.goto("/dashboard/settings");
  await page.getByText("Study settings", { exact: true }).click();
  await page.getByLabel("Study ID for settings", { exact: true }).fill("fixture-study");
  await page.getByRole("button", { name: "Load study settings" }).click();
  await page.getByLabel("Default follow-up due after days").fill("4");
  await page.getByRole("button", { name: "Save study settings" }).click();
  await expect(page.getByRole("status")).toContainText("Study settings saved");
  await page.reload();
  await page.getByText("Study settings", { exact: true }).click();
  await page.getByLabel("Study ID for settings", { exact: true }).fill("fixture-study");
  await page.getByRole("button", { name: "Load study settings" }).click();
  await expect(page.getByLabel("Default follow-up due after days")).toHaveValue("4");
});

test("coordinator can acknowledge and resolve follow-up with durable history", async ({ page }) => {
  await start(page);
  await page.getByLabel("Message type").selectOption("question");
  await page.getByLabel("Your question").fill("I need a human");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.getByRole("log")).toContainText("study coordinator or nurse");
  await page.getByRole("link", { name: "View Report", exact: true }).click();
  const panel = page.getByRole("region", { name: "Clinical follow-up" });
  await panel.getByRole("button", { name: "Refresh follow-ups" }).click();
  await expect(panel).toContainText("I need a human");
  await panel.getByLabel("Follow-up status", { exact: true }).selectOption("acknowledged");
  await panel.getByLabel("Follow-up note").fill("Will discuss this today.");
  await panel.getByRole("button", { name: "Save follow-up" }).click();
  await expect(panel).toContainText("Follow-up history (1)");
  await panel.getByLabel("Follow-up status", { exact: true }).selectOption("resolved");
  await panel.getByLabel("Follow-up note").fill("Clinical team answered the question.");
  await panel.getByRole("button", { name: "Save follow-up" }).click();
  await expect(panel).toContainText("Follow-up history (2)");
  await page.reload();
  await expect(panel.getByLabel("Follow-up status", { exact: true })).toHaveValue("resolved");
  await panel.getByText("Follow-up history (2)", { exact: true }).click();
  await expect(panel).toContainText("Clinical team answered the question.");
  await page.getByRole("button", { name: "Refresh report" }).click();
  await expect(page.getByRole("region", { name: "Understanding report" })).toContainText("resolved");
  await panel.getByLabel("Additional follow-up", { exact: true }).fill("Schedule a second discussion");
  await panel.getByRole("button", { name: "Add follow-up flag", exact: true }).click();
  await expect(panel).toContainText("Schedule a second discussion");
  await page.reload();
  await expect(panel).toContainText("Schedule a second discussion");
  await panel.getByText("External notification delivery", { exact: true }).click();
  await expect(panel).toContainText("External delivery is disabled");
  await expect(panel.getByRole("button", { name: "Queue external alert" })).toBeDisabled();
});

test("polling shows remote progress, stale drafts are rejected, and participant acknowledgment persists", async ({ page, browser }) => {
  await start(page);
  await page.getByLabel("Your teach-back response").fill("understood: an old draft for the purpose section");
  await page.getByRole("button", { name: "Create patient invitation" }).click();
  const invitation = await page.getByLabel("Patient invitation link").inputValue();
  const code = await page.getByLabel("Patient access code").inputValue();
  const context = await browser.newContext(); const patient = await context.newPage();
  try {
    await patient.goto(invitation);
    await patient.getByLabel("Access code", { exact: true }).fill(code);
    await patient.getByRole("button", { name: "Open review", exact: true }).click();
    await patient.getByRole("link", { name: "Text Chat", exact: true }).click();
    await patient.getByLabel("Your teach-back response").fill("understood: monthly visits");
    await patient.getByRole("button", { name: "Send response" }).click();
    await expect(patient.getByRole("heading", { name: "Section 2 of 2: Risks" })).toBeVisible();
    await page.bringToFront();
    await expect(page.getByRole("heading", { name: "Section 2 of 2: Risks" })).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "Send response" }).click();
    await expect(page.getByRole("alert")).toContainText("Review changed; refresh");
    await page.getByRole("button", { name: "Refresh review", exact: true }).click();
    await expect(page.getByLabel("Your teach-back response")).toHaveValue("");
    await patient.getByLabel("Your teach-back response").fill("understood: voluntary participation");
    await patient.getByRole("button", { name: "Send response" }).click();
    await expect(patient.getByRole("heading", { name: "Review completed", exact: true })).toBeVisible();
    await patient.getByRole("link", { name: "Review summary", exact: true }).click();
    await expect(patient.getByRole("button", { name: "Acknowledge review completion" })).toBeDisabled();
    await patient.getByRole("checkbox").check();
    await patient.getByRole("button", { name: "Acknowledge review completion" }).click();
    await expect(patient.getByRole("region", { name: "Review acknowledgment" })).toContainText("Recorded");
    await patient.reload();
    await expect(patient.getByRole("region", { name: "Review acknowledgment" })).toContainText("It is not consent to participate");
    await expect(patient.getByRole("button", { name: "Acknowledge review completion" })).toHaveCount(0);
  } finally { await context.close(); }
});

test("administrator creates a scoped coordinator and disables access in the workspace", async ({ page }) => {
  await open(page);
  await page.goto("/dashboard/settings");
  await page.getByText("Coordinator accounts", { exact: true }).click();
  await page.getByLabel("Account name", { exact: true }).fill("Browser Test Staff");
  await page.getByLabel("Account email", { exact: true }).fill("browser-staff@example.com");
  await page.getByLabel("Initial password").fill("test-staff-password");
  await page.getByLabel("Assigned study IDs").fill("fixture-study");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Coordinator account created");
  await expect(page.getByLabel("Initial password")).toHaveValue("");
  await page.getByText("Disable Browser Test Staff", { exact: true }).click();
  await page.getByRole("button", { name: "Confirm disable Browser Test Staff", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Account disabled");
  await expect(page.getByText(/Browser Test Staff · browser-staff@example.com/)).toContainText("Disabled");
});

test("homepage destinations, legacy links and server session expiry use one workspace", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => { if (message.text().includes("same key")) errors.push(message.text()); });
  await page.goto("/");
  await expect(page.getByRole("navigation").getByRole("link", { name: "Dashboard", exact: true })).toHaveAttribute("href", "/dashboard");
  await page.getByRole("link", { name: "Documents", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email", { exact: true }).fill("coordinator@example.com");
  await page.getByLabel("Password", { exact: true }).fill("integration-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/documents$/);
  await page.goto("/dashboard/sessions/new?document=integration-document");
  await page.getByRole("button", { name: "Create session", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Section 1 of 2: Purpose" })).toBeVisible();
  const id = new URL(page.url()).pathname.split("/")[3];
  await page.goto(`/connected?session=${id}`);
  await expect(page).toHaveURL(new RegExp(`/dashboard/sessions/${id}$`));
  await expect(page.getByRole("heading", { name: "Section 1 of 2: Purpose" })).toBeVisible();
  const signOut = await page.getByRole("button", { name: "Sign out", exact: true }).boundingBox();
  expect(signOut!.x).toBeGreaterThan(900);
  expect(signOut!.y).toBeLessThan(80);
  await context.clearCookies();
  await page.getByRole("button", { name: "Refresh review", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("log")).toHaveCount(0);
  await page.goto("/demo-login");
  await expect(page).toHaveURL(/\/login$/);
  expect(errors).toEqual([]);
});

test("patient text and voice share progress on mobile, legacy invitations work, and logout removes access", async ({ page, browser }) => {
  await start(page);
  const id = new URL(page.url()).pathname.split("/")[3];
  await page.getByRole("button", { name: "Create patient invitation" }).click();
  const invitation = (await page.getByLabel("Patient invitation link").inputValue()).replace(`/session/${id}`, `/review/${id}`);
  const code = await page.getByLabel("Patient access code").inputValue();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const patient = await context.newPage();
  try {
    await patient.goto(invitation);
    await expect(patient).toHaveURL(new RegExp(`/session/${id}$`));
    await patient.getByLabel("Access code", { exact: true }).fill(code);
    await patient.getByRole("button", { name: "Open review", exact: true }).click();
    await expect(patient.getByRole("heading", { name: "Your understanding review" })).toBeVisible();
    await patient.goto(`http://127.0.0.1:4174/session/${id}/summary`);
    await expect(patient).toHaveURL(new RegExp(`/session/${id}/chat$`));
    await patient.getByLabel("Your teach-back response").fill("unsure");
    await patient.getByRole("button", { name: "Send response" }).click();
    await expect(patient.getByText("Attempts on current section: 1")).toBeVisible();
    await patient.getByRole("link", { name: "Voice", exact: true }).click();
    await expect(patient.getByRole("heading", { name: "Voice review" })).toBeVisible();
    await expect(patient.getByText("Attempts on current section: 1")).toBeVisible();
    await expect(patient.getByRole("button", { name: "Start voice conversation" })).toBeVisible();
    await patient.reload();
    await expect(patient.getByRole("log")).toContainText("Let's review this section another way");
    const { default: AxeBuilder } = await import("@axe-core/playwright");
    expect((await new AxeBuilder({ page: patient }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations).toEqual([]);
    expect(await patient.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await patient.screenshot({ path: "test-results/patient-mobile.png", fullPage: true });
    await patient.getByRole("button", { name: "Sign out of review", exact: true }).click();
    await expect(patient.getByRole("heading", { name: "Welcome", exact: true })).toBeVisible();
    await patient.reload();
    await expect(patient.getByRole("log")).toHaveCount(0);
    expect((await context.request.get(`http://127.0.0.1:4174/api/sessions/${id}`)).status()).toBe(401);
  } finally { await context.close(); }
});

test("scoped coordinator cannot see prior account data or admin controls", async ({ page }) => {
  await open(page);
  const created = await page.request.post("/api/auth/accounts", { headers: { Origin: "http://127.0.0.1:4174" }, data: { name: "Other Study", email: "other-study@example.com", password: "scoped-test-password", role: "coordinator", studyIds: ["other-study"] } });
  expect(created.ok()).toBe(true);
  await page.getByRole("link", { name: "Documents", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Documents", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Integration Consent", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill("other-study@example.com");
  await page.getByLabel("Password", { exact: true }).fill("scoped-test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("link", { name: "Documents", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Documents", exact: true })).toBeVisible();
  await expect(page.getByText("Integration Consent", { exact: true })).toHaveCount(0);
  await page.goto("/dashboard/documents/integration-document");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("region", { name: "Document management" })).toHaveCount(0);
  await page.goto("/dashboard/settings");
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await expect(page.getByText("Coordinator accounts", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Voice setup", { exact: true })).toHaveCount(0);
});
