import { test, expect } from '@playwright/test';

/**
 * Real-browser verification of the two claims the README makes most loudly:
 *  1. The plaintext secret is never sent to the server — only ciphertext.
 *  2. A secret created and encrypted in one browser context round-trips
 *     through the actual WebCrypto API (not just the Node crypto.subtle
 *     polyfill exercised by tests/crypto.test.js) and decrypts correctly.
 *
 * tests/e2e_integration.test.js already covers this at the API layer; this
 * file exists because that suite never touches a real browser, so Safari/
 * Chrome-specific WebCrypto behavior was previously unverified.
 */

const SECRET_TEXT = `CIPHERDROP_BROWSER_TEST_SECRET_${Date.now()}`;

test('secret round-trips through real browser WebCrypto and plaintext never reaches the network', async ({ page }) => {
  const apiRequestBodies: string[] = [];
  const apiResponseBodies: string[] = [];

  page.on('request', (req) => {
    if (req.url().includes('/api/paste') && req.method() === 'POST') {
      const data = req.postData();
      if (data) apiRequestBodies.push(data);
    }
  });
  page.on('response', async (res) => {
    if (res.url().includes('/api/paste') && res.request().method() === 'POST') {
      apiResponseBodies.push(await res.text());
    }
  });

  await page.goto('/');

  // Switch to raw Plaintext mode and enter the secret.
  await page.getByRole('button', { name: 'Plaintext' }).click();
  await page.getByPlaceholder('Paste confidential message, passwords, or sensitive notes here...').fill(SECRET_TEXT);

  await page.getByRole('button', { name: /Encrypt & Create Secret Link/i }).click();

  // Wait for the create-success modal and its "Open & Verify" action.
  const openButton = page.getByRole('button', { name: 'Open & Verify Secret' });
  await expect(openButton).toBeVisible({ timeout: 10_000 });

  // The plaintext secret must never have appeared in the POST body or response.
  for (const body of [...apiRequestBodies, ...apiResponseBodies]) {
    expect(body).not.toContain(SECRET_TEXT);
  }
  expect(apiRequestBodies.length).toBeGreaterThan(0);

  // The master decryption key lives only in the URI fragment of the
  // generated share link (a readonly input in the success modal), never
  // in a query string or request body.
  const shareLinkInput = page.locator('input[readonly][value*="#p="]').first();
  const shareLink = await shareLinkInput.inputValue();
  expect(shareLink).toMatch(/#p=.+&k=.+/);

  await openButton.click();

  // Once opened, the app's own address bar should also carry the fragment.
  await expect(page).toHaveURL(/#p=.+&k=.+/);

  // Decryption happens client-side; the plaintext should now render.
  await expect(page.getByText(SECRET_TEXT)).toBeVisible({ timeout: 10_000 });
});
