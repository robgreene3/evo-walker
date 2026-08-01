import { expect, test, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";

function recordRuntimeErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function configure(
  page: Page,
  populationSize: number,
  generations: number,
): Promise<void> {
  await page
    .getByLabel("Population", { exact: true })
    .fill(String(populationSize));
  await page
    .getByLabel("Generations", { exact: true })
    .fill(String(generations));
}

function generationFrom(text: string): number {
  const value = Number.parseInt(text.split("/")[0] ?? "", 10);
  if (!Number.isInteger(value))
    throw new Error(`Invalid generation text: ${text}`);
  return value;
}

test("completes a short experiment from the keyboard", async ({ page }) => {
  const runtimeErrors = recordRuntimeErrors(page);
  await page.goto("/");
  await expect(page.locator(".app-frame")).toHaveAttribute(
    "data-status",
    "initial",
  );
  await expect(
    page.getByText("No champion yet", { exact: true }),
  ).toBeVisible();
  await configure(page, 4, 1);

  const start = page.getByRole("button", {
    name: "Start experiment",
    exact: true,
  });
  await start.focus();
  await expect(start).toHaveCSS("box-shadow", /rgb/u);
  await page.keyboard.press("Enter");

  await expect(page.locator(".app-frame")).toHaveAttribute(
    "data-status",
    "completed",
  );
  await expect(
    page.getByRole("heading", { name: "Generation 1" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Replay", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("heading", { name: "Champion genome" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Champion ancestry" }),
  ).toBeVisible();
  const aggregate = await page.locator(".aggregate strong").innerText();
  await page.getByRole("button", { name: "Save local", exact: true }).click();
  await page.getByLabel("Seed", { exact: true }).fill("7");
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await expect(page.locator(".app-frame")).toHaveAttribute(
    "data-status",
    "completed",
  );
  await page.getByRole("button", { name: "Load local", exact: true }).click();
  await expect(page.getByLabel("Seed", { exact: true })).toHaveValue("42");
  await expect(page.locator(".aggregate strong")).toHaveText(aggregate);

  await page
    .locator('input[type="file"]')
    .setInputFiles(
      fileURLToPath(
        new URL("./fixtures/unsupported-version.json", import.meta.url),
      ),
    );
  await expect(page.locator(".app-frame")).toHaveAttribute(
    "data-status",
    "error",
  );
  await expect(page.getByRole("alert")).toContainText(
    "Unsupported experiment schema version: 99.",
  );
  await expect(page.locator(".aggregate strong")).toHaveText(aggregate);
  expect(runtimeErrors).toEqual([]);
});

test("pauses, resumes, and cancels at generation boundaries", async ({
  page,
}) => {
  const runtimeErrors = recordRuntimeErrors(page);
  await page.goto("/");
  await configure(page, 64, 100);
  await page
    .getByRole("button", { name: "Start experiment", exact: true })
    .click();
  await expect(page.locator(".app-frame")).toHaveAttribute(
    "data-status",
    "running",
  );

  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.locator(".app-frame")).toHaveAttribute(
    "data-status",
    "paused",
  );
  const paused = await page.locator(".progress-label strong").innerText();
  await page.waitForTimeout(500);
  await expect(page.locator(".progress-label strong")).toHaveText(paused);

  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(page.locator(".app-frame")).toHaveAttribute(
    "data-status",
    "running",
  );
  const beforeCancel = generationFrom(
    await page.locator(".progress-label strong").innerText(),
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".app-frame")).toHaveAttribute(
    "data-status",
    "cancelled",
  );
  const afterCancel = generationFrom(
    await page.locator(".progress-label strong").innerText(),
  );

  expect(afterCancel - beforeCancel).toBeLessThanOrEqual(1);
  await expect(
    page.getByRole("button", { name: "Restart", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByText("Aggregate fitness", { exact: true }),
  ).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("preserves essential content on a reduced-motion mobile viewport", async ({
  page,
}) => {
  const runtimeErrors = recordRuntimeErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(
    page.getByRole("button", { name: "Start experiment", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Champion replay" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Generation 0" }),
  ).toBeVisible();
  const widths = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(widths.document).toBe(widths.viewport);
  expect(runtimeErrors).toEqual([]);
});
