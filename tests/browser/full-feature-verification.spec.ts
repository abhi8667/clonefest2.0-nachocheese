import { test, expect } from '@playwright/test';

test.describe('Comprehensive UI & Cryptographic Flow Verification', () => {
  test('Guided Mode: selection -> onboarding -> create secret -> decrypt viewer', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');

    // 1. Mode Selection Screen -> Pick Guided Mode
    const guidedCard = page.getByRole('button', { name: /Guided/i }).first();
    await expect(guidedCard).toBeVisible();
    await guidedCard.click();

    // 2. Onboarding Landing -> Proceed
    const proceedBtn = page.getByRole('button', { name: /Create Your First Secret/i });
    await expect(proceedBtn).toBeVisible({ timeout: 5000 });
    await proceedBtn.click();

    // 3. Secret Editor in Guided Mode
    const textarea = page.getByPlaceholder(/Type or paste whatever you want to share/i);
    await expect(textarea).toBeVisible();
    await textarea.fill('Guided secret content 12345');

    // Create Secret
    const createBtn = page.getByRole('button', { name: /Create Secret Link/i });
    await createBtn.click();

    // Modal
    const openBtn = page.getByRole('button', { name: /Open & Verify Secret/i });
    await expect(openBtn).toBeVisible({ timeout: 10000 });
    await openBtn.click();

    // Viewer Decryption
    await expect(page.getByText('Guided secret content 12345')).toBeVisible({ timeout: 10000 });

    // Expect no severe uncaught errors
    const fatalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('noise.png'));
    expect(fatalErrors).toEqual([]);
  });

  test('Operator Mode: mode select -> onboarding -> tabs & advanced crypto', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');

    // Pick Operator Mode
    const operatorCard = page.getByRole('button', { name: /Operator/i }).first();
    await expect(operatorCard).toBeVisible();
    await operatorCard.click();

    // Onboarding -> proceed
    const proceedBtn = page.getByRole('button', { name: /Create Your First Secret/i });
    await expect(proceedBtn).toBeVisible({ timeout: 5000 });
    await proceedBtn.click();

    // Check Editor tabs
    await expect(page.getByRole('button', { name: /Code/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Plaintext/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /\.ENV/i }).first()).toBeVisible();

    // Test tab navigation in Operator Mode (Drops, War Room, Stego, Vault, API / CLI)
    await page.getByRole('button', { name: 'Drops' }).click();
    await expect(page.getByText('Request-a-Secret DropBox')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'War Room' }).click();
    await expect(page.getByText('Real-Time E2EE Incident War Room')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Stego' }).click();
    await expect(page.getByText('Steganography & Forensic Attribution')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Vault' }).click();
    await expect(page.getByText('Offline Cryptographic Sandbox')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'API / CLI' }).click();
    await expect(page.getByText('Developer API & CLI Hub')).toBeVisible({ timeout: 5000 });

    // Verify Build Integrity Modal
    const verifyShield = page.getByRole('button', { name: /ZK Verified/i });
    if (await verifyShield.isVisible()) {
      await verifyShield.click();
      await expect(page.getByText('Verifiable Zero-Knowledge')).toBeVisible();
      await page.keyboard.press('Escape');
    }

    const fatalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('noise.png'));
    expect(fatalErrors).toEqual([]);
  });
});
