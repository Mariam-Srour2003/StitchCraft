import { expect, test } from '@playwright/test';
import { mockApi } from './support/mock-api';

test('sign in, create a project and pattern, paint it, save, and export', async ({ page }) => {
  await mockApi(page);

  // --- Sign in (through the real form, not seeded tokens - covers the login UI too) ---
  await page.goto('/sign-in');
  await page.getByLabel(/email/i).fill('e2e@stitchcraft.dev');
  await page.getByLabel(/password/i).fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/projects$/);

  // --- Create a project ---
  await page.getByLabel('New project name').fill('E2E Sampler');
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByText('E2E Sampler')).toBeVisible();

  // --- Create a small blank pattern inside it ---
  await page.getByRole('button', { name: 'New pattern' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill('E2E Pattern');
  await dialog.locator('input[type="number"]').first().fill('5'); // width
  await dialog.locator('input[type="number"]').nth(1).fill('5'); // height
  await dialog.getByRole('button', { name: 'Create & open' }).click();

  await expect(page).toHaveURL(/\/editor\/pattern-\d+$/);

  // --- Add a color to the (initially empty) palette ---
  await page.getByLabel('Color label').fill('E2E Red');
  await page.getByRole('button', { name: 'Add to palette' }).click();
  const swatch = page.getByRole('button', { name: /E2E Red/ });
  await expect(swatch).toBeVisible();

  // --- Select it as the active paint color, then paint a few cells ---
  await swatch.click();
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('grid-canvas bounding box unavailable');

  // Cell size is 20px at 100% zoom; click a few distinct cells inside a 5x5 grid.
  await canvas.click({ position: { x: 10, y: 10 } }); // cell (0,0)
  await canvas.click({ position: { x: 30, y: 10 } }); // cell (1,0)
  await canvas.click({ position: { x: 50, y: 50 } }); // cell (2,2)

  // --- Save ---
  const saveButton = page.getByRole('button', { name: /^Save/ });
  await expect(saveButton).toHaveText('Save'); // dirty after painting
  await saveButton.click();
  await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible();

  // --- Export and verify all four artifact links appear ---
  await page.getByRole('button', { name: 'Export' }).click();
  const exportDialog = page.getByRole('dialog').filter({ hasText: 'Export ready' });
  await expect(exportDialog).toBeVisible();
  await expect(exportDialog.getByRole('link', { name: 'Printable PDF chart' })).toBeVisible();
  await expect(exportDialog.getByRole('link', { name: 'PNG preview' })).toBeVisible();
  await expect(exportDialog.getByRole('link', { name: 'SVG preview' })).toBeVisible();
  await expect(exportDialog.getByRole('link', { name: /shopping list/ })).toBeVisible();
});
