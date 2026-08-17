import path from 'path';
import { expect, test } from '@playwright/test';
import { mockApi, signInDirectly } from './support/mock-api';

test('upload an image, convert it, and land in the editor on the saved result', async ({
  page,
}) => {
  await signInDirectly(page); // this flow is about the converter, not re-testing the login form
  await mockApi(page);

  // --- Create a project to convert into ---
  await page.goto('/projects');
  await page.getByLabel('New project name').fill('Conversion Project');
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByText('Conversion Project')).toBeVisible();

  await page.getByRole('button', { name: 'Convert image' }).click();
  await expect(page).toHaveURL(/\/converter\/proj-\d+$/);

  // --- Upload the fixture image via the hidden file input inside file-drop ---
  await page
    .locator('input[type="file"]')
    .setInputFiles(path.join(__dirname, 'fixtures', 'test-image.png'));

  // --- Configure and start the conversion ---
  await expect(page.getByRole('img', { name: 'Selected image preview' })).toBeVisible();
  await page.getByRole('button', { name: 'Convert' }).click();

  // --- Progress screen appears while the (mocked) job is polled ---
  await expect(page.getByRole('progressbar')).toBeVisible();

  // --- The mock reports "completed" on the 2nd poll; the app should then navigate into the editor ---
  await expect(page).toHaveURL(/\/editor\/pattern-\d+$/, { timeout: 15_000 });
  await expect(page.getByRole('button', { name: /^Save/ })).toBeVisible();
});
