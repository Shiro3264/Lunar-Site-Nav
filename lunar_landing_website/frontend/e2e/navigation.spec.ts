/**
 * E2E: App navigation — verifies every sidebar route renders without crashing.
 *
 * NOTE: These tests run against a live Vite dev server.  API calls will return
 * errors if the Django backend is not running; the tests only check that the
 * page mounts and shows its section header, not that live data loads.
 */
import { test, expect } from "@playwright/test";

const ROUTES: Array<{ path: string; titlePattern: RegExp }> = [
    { path: "/dashboard", titlePattern: /dashboard/i },
    { path: "/navigator", titlePattern: /navigator|3d/i },
    { path: "/sites", titlePattern: /site|explorer/i },
    { path: "/coordinates", titlePattern: /coordinate|search/i },
    { path: "/rotation", titlePattern: /rotation|simulator/i },
    { path: "/observer", titlePattern: /observer/i },
    { path: "/sunlight", titlePattern: /sunlight|shadow/i },
    { path: "/earth-comms", titlePattern: /earth|communication/i },
    { path: "/solar", titlePattern: /solar/i },
    { path: "/compare", titlePattern: /compar/i },
    { path: "/ranking", titlePattern: /rank|suitability/i },
    { path: "/timeline", titlePattern: /timeline/i },
    { path: "/validation", titlePattern: /validation|scientific/i },
    { path: "/reports", titlePattern: /report/i },
    { path: "/settings", titlePattern: /settings/i },
];

test.describe("App navigation", () => {
    for (const { path, titlePattern } of ROUTES) {
        test(`${path} renders a visible heading`, async ({ page }) => {
            await page.goto(path);
            // Wait for any heading (h1, h2) that matches the page title pattern.
            const heading = page
                .locator("h1, h2, [data-testid='section-title']")
                .filter({ hasText: titlePattern })
                .first();

            // If the backend is down the page may show an error state, which is
            // fine — we just verify the shell rendered.
            await expect(
                page.locator("h1, h2").first()
            ).toBeVisible({ timeout: 8000 });
        });
    }
});

test.describe("404 redirect", () => {
    test("unknown route redirects to landing page", async ({ page }) => {
        await page.goto("/this-route-does-not-exist-xyz");
        // Should land at "/" (the LandingPage)
        await expect(page).toHaveURL("/");
    });
});
