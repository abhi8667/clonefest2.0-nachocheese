/**
 * CipherDrop Time-Lock Secrets Automated Verification Test Suite
 * Tests server-assisted time lock gating, 423 Locked responses, post-unlock decryption,
 * expiration precedence, burn-after-reading, max views, multi-recipient integration,
 * and server-side authoritative clock enforcement.
 */

import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {
  generateMasterKey,
  encryptSecret,
  decryptSecret,
  encryptMultiRecipientSecret,
  decryptMultiRecipientSecret,
  hashSha256,
} from '../src/crypto/webcrypto.ts';

const PORT = process.env.TEST_PORT_TIMELOCK || '3012';
const BASE_URL = `http://localhost:${PORT}`;
let serverProcess = null;

before(async () => {
  serverProcess = spawn('node', ['server/index.js'], {
    stdio: 'inherit',
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'test', ENABLE_TEST_ENDPOINTS: '1', DB_PATH: ':memory:' },
  });

  // Wait for server to become responsive
  let ready = false;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) {
        ready = true;
        break;
      }
    } catch (err) {}
  }
  if (!ready) {
    throw new Error('Test server failed to start within timeout in time_lock.test.js');
  }
});

after(async () => {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 200));
  }
});

beforeEach(async () => {
  // Reset time offset on server before each test
  try {
    await fetch(`${BASE_URL}/api/test/reset-time`, { method: 'POST' });
  } catch (_) {}
});

after(async () => {
  try {
    await fetch(`${BASE_URL}/api/test/reset-time`, { method: 'POST' });
  } catch (_) {}
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }
});

test('Time-Lock: Normal secret without time-lock continues to work (Backwards Compatibility)', async () => {
  const masterKey = generateMasterKey();
  const rawSecret = { text: 'LEGACY_COMPAT_SECRET_2026', formatter: 'plaintext' };
  const encryptedPayload = await encryptSecret(rawSecret, masterKey);

  const postRes = await fetch(`${BASE_URL}/api/paste`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: encryptedPayload,
      expireInSeconds: 3600,
      timeLockEnabled: false,
    }),
  });

  assert.equal(postRes.status, 201);
  const created = await postRes.json();
  assert.equal(created.timeLockEnabled, false);
  assert.equal(created.unlockAt, null);

  const getRes = await fetch(`${BASE_URL}/api/paste/${created.id}`);
  assert.equal(getRes.status, 200);
  const fetched = await getRes.json();
  assert.ok(fetched.payload.ct);

  const decrypted = await decryptSecret(fetched.payload, masterKey);
  assert.equal(decrypted.text, rawSecret.text);
});

test('Time-Lock: Create time-locked secret -> Pre-unlock returns 423 Locked with NO ciphertext', async () => {
  const masterKey = generateMasterKey();
  const rawSecret = { text: 'TOP_SECRET_FUTURE_DISCLOSURE', formatter: 'env' };
  const encryptedPayload = await encryptSecret(rawSecret, masterKey);

  // Set unlock 1 hour (3600s) in the future
  const futureUnlockDate = new Date(Date.now() + 3600 * 1000).toISOString();

  const postRes = await fetch(`${BASE_URL}/api/paste`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: encryptedPayload,
      expireInSeconds: 7200, // 2 hours TTL
      timeLockEnabled: true,
      unlockAt: futureUnlockDate,
    }),
  });

  assert.equal(postRes.status, 201);
  const created = await postRes.json();
  assert.equal(created.timeLockEnabled, true);
  assert.ok(created.unlockAt);

  // 1. Attempt to fetch before unlockAt -> MUST return HTTP 423 Locked
  const getRes = await fetch(`${BASE_URL}/api/paste/${created.id}`);
  assert.equal(getRes.status, 423, 'Must return HTTP 423 Locked');
  
  const lockedData = await getRes.json();
  assert.equal(lockedData.error, 'TIME_LOCKED');
  assert.equal(lockedData.timeLockEnabled, true);
  assert.ok(lockedData.unlockAt);
  assert.equal(lockedData.payload, undefined, 'Payload/ciphertext must NOT be revealed before unlock');
  assert.equal(lockedData.envelopes, undefined, 'Envelopes must NOT be revealed before unlock');
});

test('Time-Lock: Retrieval after unlockAt succeeds (HTTP 200) and decrypts client-side', async () => {
  const masterKey = generateMasterKey();
  const rawSecret = { text: 'SCHEDULED_ANNOUNCEMENT_CONTENT', formatter: 'markdown' };
  const encryptedPayload = await encryptSecret(rawSecret, masterKey);

  // Set unlock 100 seconds in the future
  const unlockIso = new Date(Date.now() + 100 * 1000).toISOString();

  const postRes = await fetch(`${BASE_URL}/api/paste`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: encryptedPayload,
      expireInSeconds: 3600,
      timeLockEnabled: true,
      unlockAt: unlockIso,
    }),
  });

  const { id: pasteId } = await postRes.json();

  // Before unlock -> 423 Locked
  const beforeRes = await fetch(`${BASE_URL}/api/paste/${pasteId}`);
  assert.equal(beforeRes.status, 423);

  // Advance server time offset by 150 seconds (past unlockAt)
  await fetch(`${BASE_URL}/api/test/set-time-offset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ offsetSeconds: 150 }),
  });

  // After unlock -> 200 OK with full ciphertext
  const afterRes = await fetch(`${BASE_URL}/api/paste/${pasteId}`);
  assert.equal(afterRes.status, 200, 'Must return HTTP 200 after unlock time');
  
  const fetchedData = await afterRes.json();
  assert.ok(fetchedData.payload.ct);
  assert.equal(fetchedData.timeLockEnabled, true);

  // Client-side decryption
  const decrypted = await decryptSecret(fetchedData.payload, masterKey);
  assert.equal(decrypted.text, rawSecret.text);
  assert.equal(decrypted.formatter, rawSecret.formatter);
});

test('Time-Lock: Validation rejects invalid unlockAt parameters', async () => {
  const masterKey = generateMasterKey();
  const rawSecret = { text: 'INVALID_TEST', formatter: 'plaintext' };
  const encryptedPayload = await encryptSecret(rawSecret, masterKey);

  // 1. Missing unlockAt when timeLockEnabled is true
  const res1 = await fetch(`${BASE_URL}/api/paste`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: encryptedPayload,
      timeLockEnabled: true,
    }),
  });
  assert.equal(res1.status, 400, 'Missing unlockAt must return 400');

  // 2. Malformed date string
  const res2 = await fetch(`${BASE_URL}/api/paste`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: encryptedPayload,
      timeLockEnabled: true,
      unlockAt: 'not-a-valid-date',
    }),
  });
  assert.equal(res2.status, 400, 'Malformed date must return 400');

  // 3. Past date
  const pastDate = new Date(Date.now() - 3600 * 1000).toISOString();
  const res3 = await fetch(`${BASE_URL}/api/paste`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: encryptedPayload,
      timeLockEnabled: true,
      unlockAt: pastDate,
    }),
  });
  assert.equal(res3.status, 400, 'Past unlock date must return 400');

  // 4. unlockAt >= expireAt (unlock time later than TTL expiration)
  const tooLateDate = new Date(Date.now() + 7200 * 1000).toISOString();
  const res4 = await fetch(`${BASE_URL}/api/paste`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: encryptedPayload,
      expireInSeconds: 3600, // Expires in 1 hour
      timeLockEnabled: true,
      unlockAt: tooLateDate,  // Unlocks in 2 hours
    }),
  });
  assert.equal(res4.status, 400, 'unlockAt >= expireAt must be rejected with 400');
});

test('Time-Lock: Burn-after-reading interaction (Does NOT burn before unlock; burns on read after unlock)', async () => {
  const masterKey = generateMasterKey();
  const rawSecret = { text: 'BURN_AFTER_UNLOCK_SECRET', formatter: 'plaintext' };
  const encryptedPayload = await encryptSecret(rawSecret, masterKey);

  const unlockIso = new Date(Date.now() + 100 * 1000).toISOString();

  const postRes = await fetch(`${BASE_URL}/api/paste`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: encryptedPayload,
      expireInSeconds: 3600,
      burnAfterReading: true,
      timeLockEnabled: true,
      unlockAt: unlockIso,
    }),
  });

  const { id: pasteId } = await postRes.json();

  // 1. Multiple requests before unlock -> All return 423 and do NOT burn
  const locked1 = await fetch(`${BASE_URL}/api/paste/${pasteId}`);
  assert.equal(locked1.status, 423);
  const locked2 = await fetch(`${BASE_URL}/api/paste/${pasteId}`);
  assert.equal(locked2.status, 423);

  // 2. Advance time past unlock
  await fetch(`${BASE_URL}/api/test/set-time-offset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ offsetSeconds: 150 }),
  });

  // 3. 1st Read after unlock -> 200 OK & successful decryption
  const firstRead = await fetch(`${BASE_URL}/api/paste/${pasteId}`);
  assert.equal(firstRead.status, 200);
  const firstData = await firstRead.json();
  const decrypted = await decryptSecret(firstData.payload, masterKey);
  assert.equal(decrypted.text, rawSecret.text);

  // 4. 2nd Read after unlock -> 404 Not Found (Permanently destroyed)
  const secondRead = await fetch(`${BASE_URL}/api/paste/${pasteId}`);
  assert.equal(secondRead.status, 404, 'Secret must be destroyed after 1st read post-unlock');
});

test('Time-Lock: Max views count interaction (Does NOT decrement before unlock)', async () => {
  const masterKey = generateMasterKey();
  const rawSecret = { text: 'MAX_VIEWS_TIME_LOCKED', formatter: 'plaintext' };
  const encryptedPayload = await encryptSecret(rawSecret, masterKey);

  const unlockIso = new Date(Date.now() + 100 * 1000).toISOString();

  const postRes = await fetch(`${BASE_URL}/api/paste`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: encryptedPayload,
      expireInSeconds: 3600,
      maxViews: 2,
      timeLockEnabled: true,
      unlockAt: unlockIso,
    }),
  });

  const { id: pasteId } = await postRes.json();

  // Requests before unlock return 423
  await fetch(`${BASE_URL}/api/paste/${pasteId}`);
  await fetch(`${BASE_URL}/api/paste/${pasteId}`);

  // Advance time past unlock
  await fetch(`${BASE_URL}/api/test/set-time-offset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ offsetSeconds: 150 }),
  });

  // Read 1 (Views remaining: 1) -> 200 OK
  const read1 = await fetch(`${BASE_URL}/api/paste/${pasteId}`);
  assert.equal(read1.status, 200);
  const data1 = await read1.json();
  assert.equal(data1.viewsRemaining, 1);

  // Read 2 (Views remaining: 0 / burned) -> 200 OK
  const read2 = await fetch(`${BASE_URL}/api/paste/${pasteId}`);
  assert.equal(read2.status, 200);

  // Read 3 -> 404 Not Found
  const read3 = await fetch(`${BASE_URL}/api/paste/${pasteId}`);
  assert.equal(read3.status, 404);
});

test('Time-Lock: Multi-Recipient Envelope integration (All slots protected before unlock; slots decrypt after unlock)', async () => {
  const secretContent = { text: 'MULTI_RECIPIENT_TIMELOCKED_KEY', formatter: 'env' };
  const recipients = [
    { label: 'Alice', burnOnRead: true },
    { label: 'Bob', burnOnRead: false },
  ];

  const multiEncrypted = await encryptMultiRecipientSecret(secretContent, recipients);
  const unlockIso = new Date(Date.now() + 100 * 1000).toISOString();

  const postRes = await fetch(`${BASE_URL}/api/paste`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: multiEncrypted.payload,
      isMultiRecipient: true,
      envelopes: multiEncrypted.envelopes,
      adminTokenHash: multiEncrypted.adminTokenHash,
      expireInSeconds: 3600,
      timeLockEnabled: true,
      unlockAt: unlockIso,
    }),
  });

  assert.equal(postRes.status, 201);
  const { id: pasteId } = await postRes.json();

  const aliceSlot = multiEncrypted.recipientSecrets[0];
  const bobSlot = multiEncrypted.recipientSecrets[1];

  // 1. Alice and Bob attempt to access slots before unlock -> 423 Locked
  const aliceLocked = await fetch(`${BASE_URL}/api/paste/${pasteId}?slot=${aliceSlot.slotId}`);
  assert.equal(aliceLocked.status, 423);
  const bobLocked = await fetch(`${BASE_URL}/api/paste/${pasteId}?slot=${bobSlot.slotId}`);
  assert.equal(bobLocked.status, 423);

  // 2. Creator checks Admin Telemetry before unlock -> Slots are still unread/unburned
  const adminTokenHash = await hashSha256(multiEncrypted.adminToken);
  const adminResBefore = await fetch(`${BASE_URL}/api/paste/${pasteId}/admin?tokenHash=${encodeURIComponent(adminTokenHash)}`);
  assert.equal(adminResBefore.status, 200);
  const adminStatusBefore = await adminResBefore.json();
  assert.equal(adminStatusBefore.timeLockEnabled, true);
  assert.equal(adminStatusBefore.envelopes[0].burned, false);
  assert.equal(adminStatusBefore.envelopes[0].readAt, null);

  // 3. Advance time past unlock
  await fetch(`${BASE_URL}/api/test/set-time-offset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ offsetSeconds: 150 }),
  });

  // 4. Alice opens her slot -> 200 OK & decrypts
  const aliceRes = await fetch(`${BASE_URL}/api/paste/${pasteId}?slot=${aliceSlot.slotId}`);
  assert.equal(aliceRes.status, 200);
  const aliceData = await aliceRes.json();
  const aliceDecrypted = await decryptMultiRecipientSecret(aliceData.payload, aliceData.activeSlot, aliceSlot.slotKey);
  assert.equal(aliceDecrypted.text, secretContent.text);

  // Alice 2nd read -> 410 Gone (her slot burned)
  const aliceRes2 = await fetch(`${BASE_URL}/api/paste/${pasteId}?slot=${aliceSlot.slotId}`);
  assert.equal(aliceRes2.status, 410);

  // Bob opens his slot -> 200 OK & decrypts
  const bobRes = await fetch(`${BASE_URL}/api/paste/${pasteId}?slot=${bobSlot.slotId}`);
  assert.equal(bobRes.status, 200);
  const bobData = await bobRes.json();
  const bobDecrypted = await decryptMultiRecipientSecret(bobData.payload, bobData.activeSlot, bobSlot.slotKey);
  assert.equal(bobDecrypted.text, secretContent.text);
});

test('Time-Lock: Expiration takes precedence (Expired secret returns 404 regardless of time-lock)', async () => {
  const masterKey = generateMasterKey();
  const rawSecret = { text: 'EXPIRED_TIME_LOCK', formatter: 'plaintext' };
  const encryptedPayload = await encryptSecret(rawSecret, masterKey);

  const unlockIso = new Date(Date.now() + 60 * 1000).toISOString();

  const postRes = await fetch(`${BASE_URL}/api/paste`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: encryptedPayload,
      expireInSeconds: 120, // Expires in 120s
      timeLockEnabled: true,
      unlockAt: unlockIso,   // Unlocks in 60s
    }),
  });

  const { id: pasteId } = await postRes.json();

  // Fast forward past expiration (300 seconds)
  await fetch(`${BASE_URL}/api/test/set-time-offset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ offsetSeconds: 300 }),
  });

  // Fetch should return 404 (expired and deleted from storage)
  const expiredRes = await fetch(`${BASE_URL}/api/paste/${pasteId}`);
  assert.equal(expiredRes.status, 404, 'Expired paste must return 404 and be purged');
});

test('Time-Lock: Early deletion with deletionToken works before unlock', async () => {
  const masterKey = generateMasterKey();
  const rawSecret = { text: 'EARLY_NUKE_SECRET', formatter: 'plaintext' };
  const encryptedPayload = await encryptSecret(rawSecret, masterKey);

  const unlockIso = new Date(Date.now() + 3600 * 1000).toISOString();

  const postRes = await fetch(`${BASE_URL}/api/paste`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: encryptedPayload,
      expireInSeconds: 7200,
      timeLockEnabled: true,
      unlockAt: unlockIso,
    }),
  });

  const { id: pasteId, deleteToken } = await postRes.json();

  // Delete before unlock using deleteToken
  const deleteRes = await fetch(`${BASE_URL}/api/paste/${pasteId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deleteToken }),
  });
  assert.equal(deleteRes.status, 200);

  // Subsequent fetch must return 404
  const getRes = await fetch(`${BASE_URL}/api/paste/${pasteId}`);
  assert.equal(getRes.status, 404);
});

test('Time-Lock: Server Clock Authority (Client parameters cannot bypass server time lock)', async () => {
  const masterKey = generateMasterKey();
  const rawSecret = { text: 'AUTHORITATIVE_CLOCK_SECRET', formatter: 'plaintext' };
  const encryptedPayload = await encryptSecret(rawSecret, masterKey);

  const unlockIso = new Date(Date.now() + 3600 * 1000).toISOString();

  const postRes = await fetch(`${BASE_URL}/api/paste`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: encryptedPayload,
      expireInSeconds: 7200,
      timeLockEnabled: true,
      unlockAt: unlockIso,
    }),
  });

  const { id: pasteId } = await postRes.json();

  // Attempting to pass fake query parameters, custom timestamps, or headers does not bypass 423
  const spoofedRes = await fetch(`${BASE_URL}/api/paste/${pasteId}?time=2099-01-01T00:00:00.000Z&now=9999999999`, {
    headers: { 'X-Client-Timestamp': '2099-01-01T00:00:00.000Z' },
  });

  assert.equal(spoofedRes.status, 423, 'Spoofed client timestamps must not bypass server lock');
  const lockedData = await spoofedRes.json();
  assert.equal(lockedData.error, 'TIME_LOCKED');
});
