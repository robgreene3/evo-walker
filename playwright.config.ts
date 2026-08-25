import { defineConfig, devices } from "@playwright/test";

const e2ePort = process.env["EVOWALKER_E2E_PORT"] ?? "4173";
const baseURL = `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: "./apps/web/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 30_000 },
  reporter: "line",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: {
    command: `pnpm --filter @evowalker/web build && pnpm --filter @evowalker/web preview --host 127.0.0.1 --port ${e2ePort}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
