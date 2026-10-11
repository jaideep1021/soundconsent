import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/integration",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4174", trace: "retain-on-failure",
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    { command: "../backend/node_modules/.bin/tsx ../backend/tests/integration-server.ts", url: "http://127.0.0.1:3002/health", reuseExistingServer: false },
    { command: "npm run dev -- --host 127.0.0.1 --port 4174 --strictPort", url: "http://127.0.0.1:4174", reuseExistingServer: false, env: { API_PROXY_TARGET: "http://127.0.0.1:3002", VITE_API_URL: "/api" } },
  ],
});
