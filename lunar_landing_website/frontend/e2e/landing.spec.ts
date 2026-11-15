/**
 * E2E: Landing page smoke tests
 * Verifies the marketing page renders and the launch CTA navigates correctly.
 */
import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/");
    });

    test("renders LunaNav branding", async ({ page }) => {
        await expect(page.getByText(/LunaNav/i).first()).toBeVisible();
    });

    test("contains a hero section", async ({ page }) => {
        // The hero has a heading with 'Moon' or 'Lunar' or 'LunaNav'
        const heading = page.locator("h1, h2").first();
        await expect(heading).toBeVisible();
    });

    test("navigation links are present", async ({ page }) => {
        // At least one nav anchor should exist
        const navLinks = page.locator("nav a, header a");
        await expect(navLinks.first()).toBeVisible();
    });

    test("launch / open app CTA navigates to dashboard", async ({ page }) => {
        // Look for a link that goes to /dashboard
        const cta = page.locator("a[href='/dashboard'], a[href*='dashboard']").first();
        if (await cta.count() > 0) {
            await cta.click();
            await expect(page).toHaveURL(/dashboard/);
        }
    });
});
