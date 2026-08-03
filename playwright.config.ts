import os from "node:os";
import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

const e2eStorageRoot = path.join(os.tmpdir(), `320-archive-e2e-${process.pid}`);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [{
    command: "node e2e/fixture-server.mjs",
    url: "http://127.0.0.1:3101",
    reuseExistingServer: false,
    env: { ...process.env, ARCHIVE_E2E_FIXTURE_PORT: "3101" },
  }, {
    command: "pnpm dev --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      ARCHIVE_DATABASE_PATH: path.join(e2eStorageRoot, "archive.db"),
      ARCHIVE_STORAGE_ROOT: path.join(e2eStorageRoot, "archives"),
      ARCHIVE_E2E: "1",
      ARCHIVE_E2E_FIXTURE_PORT: "3101",
      ARCHIVE_RATE_MAX_SUBMISSIONS: "20",
      ARCHIVE_STORAGE_MAX_BYTES: "10485760",
      ARCHIVE_ASSET_MAX_BYTES: "1024",
      ARCHIVE_ASSET_TOTAL_MAX_BYTES: "8192",
      ARCHIVE_ASSET_TIMEOUT_MS: "250",
    },
  }],
});
