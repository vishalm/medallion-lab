import { test, expect } from '@playwright/test';

// Act 7 is the SQL playground. The two things students try first are
// (a) clicking "Run" on the starter query, and (b) typing something
// destructive to see what happens. Both must be rock-solid on stage.
test.describe('Act 7 — SQL playground', () => {
  test('runs the starter query and renders rows + latency', async ({ page }) => {
    await page.goto('/act/7');

    // Wait for Monaco to mount — the editor lazy-loads.
    await expect(page.locator('.monaco-container')).toBeVisible();

    await page.getByRole('button', { name: /^Run$/ }).click();

    // Latency stat appears once the API responds. The fixture data has
    // categories, so revenue rows are guaranteed.
    await expect(page.getByText(/Latency/i)).toBeVisible();
    await expect(page.getByText(/^Rows$/)).toBeVisible();

    // Backend should round-trip the same query directly. This proves the
    // SPA isn't faking results from a cached render.
    const direct = await page.request.post('/api/act7/run', {
      data: {
        sql: 'SELECT category, SUM(amount) AS rev FROM gold_fact_sales f JOIN gold_dim_product p ON p.product_id = f.product_id GROUP BY category',
      },
    });
    expect(direct.ok()).toBeTruthy();
    const body = await direct.json();
    expect(body.rows.length).toBeGreaterThan(0);
    expect(body.latency_ms).toBeGreaterThanOrEqual(0);
  });

  test('rejects destructive SQL with a friendly error (defence in depth)', async ({ page }) => {
    // Hit the API directly — easier to assert than driving Monaco from
    // Playwright, and it's exactly the contract the UI relies on.
    const dml = await page.request.post('/api/act7/run', {
      data: { sql: 'DROP TABLE gold_fact_sales' },
    });
    expect(dml.ok()).toBeTruthy();
    const body = await dml.json();
    expect(body.error).toBeTruthy();
    expect(body.error).toMatch(/blocked|allowed/i);

    // Stacked statements must also be refused — the regex should catch
    // the smuggled DELETE even though the lead is SELECT.
    const stacked = await page.request.post('/api/act7/run', {
      data: { sql: 'SELECT 1; DELETE FROM gold_fact_sales' },
    });
    const stackedBody = await stacked.json();
    expect(stackedBody.error).toBeTruthy();
  });
});
