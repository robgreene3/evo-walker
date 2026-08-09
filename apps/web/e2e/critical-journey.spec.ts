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
  founders: number,
  archiveBins: number,
): Promise<void> {
  await page.getByLabel("Founders", { exact: true }).fill(String(founders));
  await page
    .getByLabel("Archive grid", { exact: true })
    .fill(String(archiveBins));
}

function evaluationsFrom(text: string): number {
  const value = Number.parseInt(text, 10);
  if (!Number.isInteger(value))
    throw new Error(`Invalid evaluation text: ${text}`);
  return value;
}

async function stopExploration(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(page.locator(".app-frame")).toHaveAttribute(
    "data-status",
    "stopped",
  );
}

test("runs, checkpoints, restores, and validates a continuous experiment", async ({
  page,
}) => {
  const runtimeErrors = recordRuntimeErrors(page);
  await page.goto("/");
  await expect(page.locator(".app-frame")).toHaveAttribute(
    "data-status",
    "initial",
  );
  await expect(
    page.getByText("No viable champion yet", { exact: true }),
  ).toBeVisible();
  await configure(page, 4, 4);

  const start = page.getByRole("button", {
    name: "Begin evolution",
    exact: true,
  });
  await start.focus();
  await expect(start).toHaveCSS("box-shadow", /rgb/u);
  await page.keyboard.press("Enter");
  await expect(page.locator(".app-frame")).toHaveAttribute(
    "data-status",
    "running",
  );
  await expect(
    page.getByRole("button", { name: "Replay", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("heading", { name: /evaluations$/u }),
  ).toBeVisible();
  await stopExploration(page);

  await expect(
    page.getByRole("heading", { name: "Champion controller" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Champion ancestry" }),
  ).toBeVisible();
  const aggregate = await page.locator(".aggregate strong").innerText();
  await page.getByRole("button", { name: "Save local", exact: true }).click();
  await page.getByLabel("Seed", { exact: true }).fill("7");
  await page.getByRole("button", { name: "Start fresh", exact: true }).click();
  await expect(page.locator(".app-frame")).toHaveAttribute(
    "data-status",
    "running",
  );
  await stopExploration(page);
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

test("pauses, resumes, and stops at evaluation boundaries", async ({
  page,
}) => {
  const runtimeErrors = recordRuntimeErrors(page);
  await page.goto("/");
  await configure(page, 8, 4);
  await page
    .getByRole("button", { name: "Begin evolution", exact: true })
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
  const heading = page.getByRole("heading", { name: /evaluations$/u });
  const paused = await heading.innerText();
  await page.waitForTimeout(500);
  await expect(heading).toHaveText(paused);
  await expect(
    page.getByRole("button", { name: "Save local", exact: true }),
  ).toBeEnabled();

  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(page.locator(".app-frame")).toHaveAttribute(
    "data-status",
    "running",
  );
  await stopExploration(page);
  const stoppedAt = evaluationsFrom(await heading.innerText());
  await page.waitForTimeout(500);

  expect(evaluationsFrom(await heading.innerText())).toBe(stoppedAt);
  await expect(
    page.getByRole("button", { name: "Continue", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByText("Aggregate fitness", { exact: true }),
  ).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("replays a gait-atlas specimen while evolution continues", async ({
  page,
}) => {
  const runtimeErrors = recordRuntimeErrors(page);
  await page.goto("/");
  await configure(page, 4, 4);
  await page
    .getByRole("button", { name: "Begin evolution", exact: true })
    .click();
  await expect(page.locator(".app-frame")).toHaveAttribute(
    "data-status",
    "running",
  );

  const archiveSpecimen = page.locator(".archive-cell.occupied").first();
  await expect(archiveSpecimen).toBeVisible();
  const heading = page.getByRole("heading", { name: /evaluations$/u });
  const before = evaluationsFrom(await heading.innerText());
  await archiveSpecimen.focus();
  await page.keyboard.press("Enter");

  await expect(
    page.getByText("Archive specimen", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Specimen controller", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Score reproduced", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => evaluationsFrom(await heading.innerText()))
    .toBeGreaterThan(before);

  await page
    .getByRole("button", { name: "Follow live champion", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Uninterrupted champion replay",
      exact: true,
    }),
  ).toBeVisible();
  await stopExploration(page);
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
    page.getByRole("button", { name: "Begin evolution", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Uninterrupted champion replay" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "0 evaluations" }),
  ).toBeVisible();
  const widths = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(widths.document).toBe(widths.viewport);
  expect(runtimeErrors).toEqual([]);
});
