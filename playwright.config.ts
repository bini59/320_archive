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
  webServer: {
    command: "pnpm dev --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      ARCHIVE_DATABASE_PATH: path.join(e2eStorageRoot, "archive.db"),
      ARCHIVE_STORAGE_ROOT: path.join(e2eStorageRoot, "archives"),
    },
  },
});
