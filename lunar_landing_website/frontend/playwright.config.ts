import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright end-to-end test configuration.
 *
 * Tests run against the Vite preview server (pre-built bundle) so they
 * exercise the real compiled app.  The Django backend must be running
 * separately (see README — the proxy forwards /api to localhost:8000).
 *
 * Run:  npm run e2e
 */
export default defineConfig({
    testDir: "./e2e",
    /* One retry on CI to guard against transient timing issues. */
    retries: process.env.CI ? 1 : 0,
    /* Run tests in parallel. */
    workers: process.env.CI ? 2 : undefined,
    reporter: [["html", { outputFolder: "playwright-report", open: "never" }], ["list"]],

    use: {
        /* Base URL — the Vite dev server started by webServer below. */
        baseURL: "http://localhost:5173",
        /* Capture traces only on first retry, to keep CI artifacts small. */
        trace: "on-first-retry",
        /* Screenshots only on failure. */
        screenshot: "only-on-failure",
        /* Short action timeout for snappy tests. */
        actionTimeout: 10_000,
    },

    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
        {
            name: "mobile-chrome",
            use: { ...devices["Pixel 5"] },
        },
    ],

    /* Start the Vite dev server before running tests. */
    webServer: {
        command: "npm run dev",
        url: "http://localhost:5173",
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
    },
});
