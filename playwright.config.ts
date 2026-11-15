import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  fullyParallel: true,
  workers: 3,
  use: {
    baseURL: "http://127.0.0.1:3010",
    viewport: { width: 1440, height: 1000 },
    launchOptions: { args: ["--no-sandbox", "--enable-unsafe-swiftshader"] },
  },
  webServer: {
    command: "python3 -m http.server 3010 --directory out",
    port: 3010,
    reuseExistingServer: false,
  },
  reporter: [
    ["list"],
    ["json", { outputFile: "verification/test-results.json" }],
  ],
});
