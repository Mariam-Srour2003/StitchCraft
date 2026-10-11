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

  // --- The photo opens with the photo check beside it ---
  const photo = page.getByRole('img', { name: 'Photo to convert' });
  await expect(photo).toBeVisible();
  await expect(page.getByText('Problem: The face will be too small to recognise')).toBeVisible();
  await expect(page.getByText('9 st', { exact: true })).toBeVisible(); // face marked on the photo

  // --- Prepare the photo: rotate, drag a crop, then take the advisor's crop ---
  await page.getByRole('button', { name: 'Rotate right' }).click();
  const box = await photo.boundingBox();
  if (!box) throw new Error('photo has no layout box');
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.1);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.8, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole('group', { name: /Crop area/ })).toBeVisible();
  await page.getByRole('button', { name: 'Crop to the face' }).click();
  await page.getByLabel('Brightness').fill('20');

  await page.getByRole('radio', { name: 'Pattern preview' }).click();
  await expect(page.getByRole('img', { name: /Preview of the pattern/ })).toBeVisible();

  // --- Configure and start the conversion ---
  await page.getByRole('button', { name: 'Convert', exact: true }).click();

  // --- Progress screen appears while the (mocked) job is polled ---
  await expect(page.getByRole('progressbar')).toBeVisible();

  // --- The mock reports "completed" on the 2nd poll; the app should then navigate into the editor ---
  await expect(page).toHaveURL(/\/editor\/pattern-\d+(\?converted=1)?$/, { timeout: 15_000 });
  await expect(page.getByRole('button', { name: /^Save/ })).toBeVisible();
});
