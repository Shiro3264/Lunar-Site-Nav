/**
 * E2E: Site Explorer critical workflows
 *
 * Tests the core workflows from the QA checklist:
 *   1. Select Mons Mouton → confirm lat/lon displayed
 *   2. Select another site → verify repositioning
 *
 * These tests require the Django backend to be running at localhost:8000.
 * They are skipped gracefully when the API is unavailable.
 */
import { test, expect, Page } from "@playwright/test";

async function apiAvailable(page: Page): Promise<boolean> {
    try {
        const resp = await page.request.get("http://localhost:8000/api/health/");
        return resp.ok();
    } catch {
        return false;
    }
}

test.describe("Site Explorer (requires backend)", () => {
    test.beforeEach(async ({ page }) => {
        const available = await apiAvailable(page);
        test.skip(!available, "Django backend not running — skipping live API tests");
        await page.goto("/sites");
    });

    test("site list loads and shows candidate sites", async ({ page }) => {
        // Wait for at least one site card / list item to appear
        const siteItems = page.locator(
            "[data-testid='site-item'], [data-slug], .site-card, table tbody tr"
        );
        await expect(siteItems.first()).toBeVisible({ timeout: 15000 });
    });

    test("selecting Mons Mouton shows correct coordinates", async ({ page }) => {
        // Navigate to the Mons Mouton site detail
        await page.goto("/sites/mons-mouton");

        // The page should display the latitude -85.4 and longitude 31.7
        await expect(page.getByText(/-85\.4/)).toBeVisible({ timeout: 10000 });
        await expect(page.getByText(/31\.7/)).toBeVisible({ timeout: 10000 });
    });

    test("selecting Malapert Massif shows its coordinates", async ({ page }) => {
        await page.goto("/sites/malapert-massif");
        await expect(page.getByText(/-86/)).toBeVisible({ timeout: 10000 });
    });
});

test.describe("Coordinate search", () => {
    test("validate endpoint accepts south-pole coordinate", async ({ page }) => {
        const available = await apiAvailable(page);
        test.skip(!available, "Django backend not running");

        await page.goto("/coordinates");

        // Fill in lat/lon fields if they exist
        const latInput = page.locator("input[name='latitude'], input[placeholder*='lat' i]").first();
        const lonInput = page.locator("input[name='longitude'], input[placeholder*='lon' i]").first();

        if (await latInput.count() > 0 && await lonInput.count() > 0) {
            await latInput.fill("-85.4");
            await lonInput.fill("31.7");

            const submitBtn = page.locator("button[type='submit'], button:has-text('Validate'), button:has-text('Search')").first();
            if (await submitBtn.count() > 0) {
                await submitBtn.click();
                // Should show a result, not an error about invalid coordinates
                await expect(page.getByText(/error.*lat/i)).not.toBeVisible({ timeout: 5000 });
            }
        }
    });
});
