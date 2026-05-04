import { test, expect } from '@playwright/test';

// Smoke test for the home page. The lecture starts here, so this is the
// single most important screen — if this regresses, the demo is dead.
test.describe('Overview page', () => {
  test('renders the Medallion Lab hero and both hero acts', async ({ page }) => {
    await page.goto('/');

    // Brand name in the hero — proves the SPA mounted, fonts loaded,
    // and React Router is on the root route.
    await expect(page).toHaveTitle(/Medallion Lab/i);
    await expect(page.locator('text=Medallion').first()).toBeVisible();

    // Both hero acts must be on the page (Act 5 + Act 9 — see CLAUDE.md
    // "two heroes"). They are the lecture's anchors.
    await expect(page.getByRole('link', { name: /Open Act 05/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Open Act 09/i })).toBeVisible();

    // Highlights strip — quick visual proof of breadth (4 stats).
    const highlights = page.locator('section').first().locator('.panel');
    await expect(highlights).toHaveCount(4);
  });

  test('clicking the Medallion hero navigates to /act/5', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Open Act 05/i }).click();
    await expect(page).toHaveURL(/\/act\/5$/);
    // Act 5 page should mount and call the backend at least once.
    const layerCounts = await page.request.get('/api/act5/counts');
    expect(layerCounts.ok()).toBeTruthy();
    const body = await layerCounts.json();
    expect(body.bronze).toBeGreaterThan(0);
  });
});
