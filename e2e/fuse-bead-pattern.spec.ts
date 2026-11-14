import { expect, test } from '@playwright/test';
import { mockApi } from './support/mock-api';

test('create a fuse-bead pattern on Hama boards, add a bead colour and place beads', async ({
  page,
}) => {
  await mockApi(page);

  await page.goto('/sign-in');
  await page.getByLabel(/email/i).fill('e2e@hobbygrid.dev');
  await page.getByLabel(/password/i).fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/projects$/);

  await page.getByLabel('New project name').fill('Bead sprites');
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByText('Bead sprites')).toBeVisible();

  // --- A 20 x 20 Hama Midi design on small 14 x 14 boards ---
  await page.getByRole('button', { name: 'New pattern' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill('Mushroom');
  await dialog.getByLabel('Type').selectOption('fuse_bead');
  await dialog.getByLabel('Bead line').selectOption('hama-midi');
  await dialog.getByLabel('Pegboard').selectOption({ label: '14 × 14 (small, 5 mm)' });
  await dialog.locator('input[type="number"]').first().fill('20');
  await dialog.locator('input[type="number"]').nth(1).fill('20');
  await dialog.getByRole('button', { name: 'Create & open' }).click();
  await expect(page).toHaveURL(/\/editor\/pattern-\d+$/);

  // Sized in beads, on 2 x 2 boards, at Hama's 5 mm.
  await expect(page.getByText('20 × 20 beads')).toBeVisible();
  await expect(page.getByText('2 × 2 boards of 14 × 14 pegs')).toBeVisible();
  await expect(page.getByText(/at 5mm beads/)).toBeVisible();

  // --- The palette comes from Hama, not DMC ---
  await expect(page.getByPlaceholder(/Add Hama Midi bead/)).toBeVisible();
  await page.getByPlaceholder(/Add Hama Midi bead/).fill('black');
  await page.getByRole('button', { name: /Add Hama H\d+ Black/ }).click();
  const swatch = page.getByRole('button', { name: /Hama H\d+ — Black/ });
  await expect(swatch).toBeVisible();

  // --- Place a few beads ---
  await swatch.click();
  const canvas = page.locator('sc-grid-canvas canvas').first();
  await expect(canvas).toBeVisible();
  for (const [x, y] of [
    [10, 10],
    [30, 10],
    // Cells are 20px at 100% zoom, so cell 13 (x 260-280) is the last on the
    // first 14-peg board and cell 14 the first on the next.
    [270, 270],
    [290, 270],
  ]) {
    await canvas.click({ position: { x, y } });
  }

  await expect(page.getByRole('button', { name: /^Save/ })).toHaveText('Save');
  await page.getByRole('button', { name: /^Save/ }).click();
  await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible();

  await canvas.screenshot({ path: test.info().outputPath('fuse-bead-canvas.png') });
});
