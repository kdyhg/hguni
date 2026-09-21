import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3000", trace: "on-first-retry" },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000/api/health",
    reuseExistingServer: true,
    env: { ...process.env, USE_MOCK_DATA: "true", APP_ENV: "development" },
  },
  projects: [
    { name: "tablet-portrait", use: { ...devices["iPad (gen 7)"] } },
    { name: "mobile", use: { ...devices["iPhone 13"] } },
  ],
});
