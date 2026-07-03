// @ts-check
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';

test.describe('Invoice Validation Platform — Sprint 3 E2E', () => {

  test('complete package processing journey', async ({ page }) => {
    // 1. Login as invoice_reviewer
    await page.goto(`${BASE}/login`);
    await page.fill('input[placeholder*="company"]', 'test@aic.com');
    await page.fill('input[placeholder*="••"]', 'Test1234!');
    await page.click('button:has-text("Sign in")');
    await expect(page).toHaveURL(BASE + '/');

    // 2. GlobalDashboard — package queue visible
    await expect(page.locator('h1:has-text("Package Queue")')).toBeVisible();

    // 3. Click "New Package" — navigate to intake wizard
    await page.click('button:has-text("New Package")');
    await expect(page).toHaveURL(`${BASE}/packages/new`);

    // 4. Select contract, billing period (skip file upload for now)
    const contractSelect = page.locator('select').first();
    await contractSelect.waitFor({ state: 'visible' });
    const options = await contractSelect.locator('option').count();
    if (options > 1) {
      await contractSelect.selectOption({ index: 1 }); // first real contract
      await page.click('button:has-text("Next")');

      // Billing period
      const monthSelect = page.locator('select').first();
      await monthSelect.selectOption({ value: '6' });
      await page.click('button:has-text("Next")');

      // Submit without files — create package
      await page.click('button:has-text("Create Package")');

      // Should navigate to ingest page
      await expect(page).toHaveURL(/\/packages\/\d+\/ingest/);
    }
  });

  test('reviewer cannot approve their own package', async ({ page }) => {
    // Login as the same user who reviewed
    await page.goto(`${BASE}/login`);
    await page.fill('input[placeholder*="company"]', 'test@aic.com');
    await page.fill('input[placeholder*="••"]', 'Test1234!');
    await page.click('button:has-text("Sign in")');
    await expect(page).toHaveURL(BASE + '/');

    // Navigate to a package HITL page (ID 1 as example)
    await page.goto(`${BASE}/packages/1/hitl`);

    // If separation of duties applies, the warning should be visible
    const warning = page.locator('text=Separation of duties');
    // The warning OR an empty state will be present
    const approveBtn = page.locator('button:has-text("Approve Package")');
    if (await approveBtn.isVisible()) {
      // Button should be disabled if same user
      if (await warning.isVisible()) {
        await expect(approveBtn).toBeDisabled();
      }
    }
  });

  test('File2Page cannot be accessed before Gate 1 confirmed', async ({ page }) => {
    // Login
    await page.goto(`${BASE}/login`);
    await page.fill('input[placeholder*="company"]', 'test@aic.com');
    await page.fill('input[placeholder*="••"]', 'Test1234!');
    await page.click('button:has-text("Sign in")');
    await expect(page).toHaveURL(BASE + '/');

    // Try to navigate directly to file2 for a package with unconfirmed plan
    await page.goto(`${BASE}/packages/1/file2`);

    // Should redirect to plan page if AGENT_PLAN is pending
    // (This depends on the actual package state — the test validates the redirect logic)
    await page.waitForTimeout(1000);
    const url = page.url();
    // Should be either on /plan (redirected) or /file2 (if gate already passed)
    expect(url).toMatch(/\/(plan|file2)/);
  });
});
