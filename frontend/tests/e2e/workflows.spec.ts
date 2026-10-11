import { test, expect, type Page } from "@playwright/test";
async function login(page: Page) {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email", { exact: true }).fill("demo@example.com");
  await page.getByLabel("Demo password").fill("demo");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
}
test("guarded coordinator creation → verified patient review → persisted report", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page);
  await page.getByRole("link", { name: "New Session", exact: true }).click();
  await page.getByRole("button", { name: "Generate Patient Link" }).click();
  await expect(page.getByText("Enter a full name.")).toBeVisible();
  await page.getByLabel("Patient Full Name").fill("Sam Example");
  await page.getByLabel("Date of Birth").fill("1990-03-12");
  await page.getByLabel("Select ICF Document").selectOption("1");
  await page.getByRole("button", { name: "Generate Patient Link" }).click();
  const url = await page.getByLabel("Patient session link").inputValue();
  const id = url.split("/").pop()!;
  await page.goto(`/session/${id}/summary`);
  await expect(page).toHaveURL(new RegExp(`/session/${id}$`));
  await page.getByLabel("Full Name", { exact: true }).fill("sam  example");
  await page.getByLabel("Date of Birth").fill("1990-03-12");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "I’m Ready to Begin" }).click();
  await page.reload();
  for (let i = 0; i < 3; i++) {
    await page
      .getByLabel("Your response or question")
      .fill("I have a question about this section.");
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await expect(
      page.getByText(`${i} of 3 reviewed`, { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /Continue to (next section|summary)/ })
      .click();
  }
  await page.getByRole("button", { name: "Review summary" }).click();
  await page.getByRole("button", { name: "Save Demo Signature" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Please enter Sam Example",
  );
  await page.getByLabel("Type your full name to sign").fill(" SAM   example ");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Save Demo Signature" }).click();
  await expect(page.getByRole("heading", { name: "Thank You" })).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Signed by SAM example/)).toBeVisible();
  await page.goto(`/dashboard/sessions/${id}/report`);
  await expect(
    page.getByText("Sam Example · Total Knee Arthroplasty"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Needs Follow-Up (Priority)" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Acknowledge & Clear Flag" }).click();
  await page.reload();
  await expect(page.getByText(/Flag acknowledged/)).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Report (.txt)" }).click();
  expect((await download).suggestedFilename()).toBe(`demo-report-${id}.txt`);
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  expect(errors).toEqual([]);
});
test("document picker validation, search, editing and refresh persistence", async ({
  page,
}) => {
  await login(page);
  await page.goto("/dashboard/documents");
  await page.getByLabel("Search documents").fill("Cataract");
  await expect(
    page.getByRole("link", { name: "Cataract Surgery", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Total Knee Arthroplasty", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Upload Document" }).click();
  await page.getByLabel("Select PDF", { exact: true }).setInputFiles({
    name: "bad.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("bad"),
  });
  await expect(page.getByRole("alert")).toHaveText("Choose a PDF file.");
  await page.getByLabel("Select PDF", { exact: true }).setInputFiles({
    name: "demo.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nDemo"),
  });
  await page.getByRole("button", { name: "Create Local Draft" }).click();
  await page.getByLabel("Document title").fill("Edited Demo");
  await page.getByRole("button", { name: "Add Section" }).click();
  await page.getByLabel("Section title").fill("Overview");
  await page
    .getByLabel("Content", { exact: true })
    .fill("Demonstration content.");
  await page.getByLabel("Status", { exact: true }).selectOption("Active");
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByText("Document saved in this tab.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Document title")).toHaveValue("Edited Demo");
  await expect(page.getByLabel("Content", { exact: true })).toHaveValue(
    "Demonstration content.",
  );
});
test("invalid links, 404, readable tokens and mobile navigation", async ({
  page,
}) => {
  await page.goto("/session/does-not-exist/chat");
  await expect(
    page.getByRole("heading", { name: "Session unavailable" }),
  ).toBeVisible();
  await page.goto("/does-not-exist");
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await expect(
    page.getByRole("link", { name: "Documents", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const color = await page
    .locator("[data-demo-banner]")
    .evaluate((el) => getComputedStyle(el).color);
  expect(color).toBe("rgb(95, 95, 93)");
  await page.keyboard.press("Tab");
});

test("accessibility checks and mobile patient input remain usable", async ({
  page,
}, testInfo) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  const audit = async () => {
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  };
  await login(page);
  for (const path of [
    "/dashboard",
    "/dashboard/documents",
    "/dashboard/documents/1",
    "/dashboard/sessions/new",
    "/dashboard/sessions/1/report",
    "/dashboard/settings",
  ]) {
    await page.goto(path);
    await expect(page.locator("main h1")).toBeVisible();
    await audit();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Settings", exact: true }),
  ).toBeInViewport({ ratio: 1 });
  await page.screenshot({
    path: testInfo.outputPath("mobile-dashboard.png"),
    fullPage: true,
  });
  await page.goto("/session/mock-session-1");
  await page.getByLabel("Full Name", { exact: true }).fill("Jane Doe");
  await page.getByLabel("Date of Birth").fill("1980-05-15");
  await audit();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "I’m Ready to Begin" }).click();
  await expect(page.getByRole("log")).toContainText("Demo prompt");
  await audit();
  const input = page.getByLabel("Your response or question");
  await expect(input).toBeInViewport({ ratio: 1 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("mobile-chat.png"),
    fullPage: true,
  });
  for (let i = 0; i < 15; i++) {
    await input.fill(
      `Long transcript message ${i}. This question needs further discussion with my care team.`,
    );
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click();
  }
  const log = page.getByRole("log");
  await log.evaluate((el) => {
    el.scrollTop = 0;
    el.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await input.fill("Another question");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Jump to latest messages" }),
  ).toBeVisible();
  expect(await log.evaluate((el) => el.scrollTop)).toBe(0);
  await page.getByRole("button", { name: "Jump to latest messages" }).click();
});
