/**
 * CipherDrop Full End-to-End Integration & API Verification Suite
 * Tests REST Endpoints, WebSocket Blind Relay, Duress Mode, Inbound Drops, Burn Lifecycles
 */

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
import {
  generateMasterKey,
  encryptSecret,
  decryptSecret,
  generateAsymmetricDropKeys,
  encryptInboundDrop,
  decryptInboundDrop,
  encryptMultiRecipientSecret,
  decryptMultiRecipientSecret,
  hashSha256,
} from '../src/crypto/webcrypto.ts';

const PORT = process.env.TEST_PORT_E2E || '3011';
const BASE_URL = `http://127.0.0.1:${PORT}`;
let serverProcess = null;
let serverErrOutput = '';

before(async () => {
  serverProcess = spawn('node', ['server/index.js'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'test', ENABLE_TEST_ENDPOINTS: '1', DB_PATH: ':memory:' },
  });

  serverProcess.stderr.on('data', (d) => { serverErrOutput += d.toString(); });
  serverProcess.stdout.on('data', (d) => { /* suppress banner in test */ });

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
    throw new Error(`Test server failed to start within timeout in e2e_integration.test.js. Stderr: ${serverErrOutput}`);
  }
});

after(async () => {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 200));
  }
});

test('E2E: Create Secret -> Fetch -> Decrypt -> Verified', async () => {
  const masterKey = generateMasterKey();
  const rawSecret = {
    text: 'CONFIDENTIAL_PRODUCTION_KEY=sk_live_998877665544332211',
    formatter: 'env',
  };

  const encryptedPayload = await encryptSecret(rawSecret, masterKey);

  // 1. Post to API
  const postRes = await fetch(`${BASE_URL}/api/paste`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: encryptedPayload,
      expireInSeconds: 3600,
      burnAfterReading: false,
      openDiscussion: true,
    }),
  });

  assert.equal(postRes.status, 201);
  const { id: pasteId, deleteToken } = await postRes.json();
  assert.ok(pasteId);
  assert.ok(deleteToken);

  // 2. Fetch blind ciphertext from API
  const getRes = await fetch(`${BASE_URL}/api/paste/${pasteId}`);
  assert.equal(getRes.status, 200);
  const fetchedPaste = await getRes.json();
  assert.equal(fetchedPaste.id, pasteId);
  assert.ok(fetchedPaste.payload.ct);

  // 3. Decrypt client-side
  const decrypted = await decryptSecret(fetchedPaste.payload, masterKey);
  assert.equal(decrypted.text, rawSecret.text);
  assert.equal(decrypted.formatter, rawSecret.formatter);
});

test('E2E: Duress / Decoy Password Plausible Deniability', async () => {
  const masterKey = generateMasterKey();
  const realPassword = 'RealMasterPassword#2026';
  const duressPassword = 'CoercedDuressPassword#999';

  const realSecret = {
    text: 'REAL_PRIVATE_KEY: -----BEGIN RSA PRIVATE KEY----- MIIEowIBAAKCAQEA0...',
    formatter: 'code',
  };

  const decoySecret = {
    text: 'DECOY_NOTES: Standard staging maintenance log for Monday',
    formatter: 'plaintext',
  };

  const encryptedPayload = await encryptSecret(realSecret, masterKey, {
    password: realPassword,
    duressPassword: duressPassword,
    decoyData: decoySecret,
  });

  const postRes = await fetch(`${BASE_URL}/api/paste`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: encryptedPayload,
      expireInSeconds: 3600,
      burnAfterReading: false,
    }),
  });
  const { id: pasteId } = await postRes.json();

  const getRes = await fetch(`${BASE_URL}/api/paste/${pasteId}`);
  const fetched = await getRes.json();

  // Test Case A: Enter Real Password -> Returns Real Secret
  const realResult = await decryptSecret(fetched.payload, masterKey, realPassword);
  assert.equal(realResult.text, realSecret.text);
  assert.ok(!realResult.isDecoy);

  // Test Case B: Enter Duress Password -> Seamlessly Returns Decoy Secret
  const duressResult = await decryptSecret(fetched.payload, masterKey, duressPassword);
  assert.equal(duressResult.text, decoySecret.text);
  assert.equal(duressResult.isDecoy, true);
});

test('E2E: Burn-After-Reading Atomic Destruction', async () => {
  const masterKey = generateMasterKey();
  const secret = { text: 'BURN_ME_IMMEDIATELY', formatter: 'plaintext' };
  const encrypted = await encryptSecret(secret, masterKey);

  const postRes = await fetch(`${BASE_URL}/api/paste`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: encrypted,
      expireInSeconds: 3600,
      burnAfterReading: true,
    }),
  });
  const { id: pasteId } = await postRes.json();

  // 1st Read: Must succeed and return payload
  const firstRead = await fetch(`${BASE_URL}/api/paste/${pasteId}`);
  assert.equal(firstRead.status, 200);
  const firstData = await firstRead.json();
  const decrypted = await decryptSecret(firstData.payload, masterKey);
  assert.equal(decrypted.text, secret.text);

  // 2nd Read: Must return 404 (already destroyed from storage)
  const secondRead = await fetch(`${BASE_URL}/api/paste/${pasteId}`);
  assert.equal(secondRead.status, 404);
});

test('E2E: Encrypted Threaded Discussion Comments', async () => {
  const masterKey = generateMasterKey();
  const secret = { text: 'ROOT_POST', formatter: 'plaintext' };
  const encrypted = await encryptSecret(secret, masterKey);

  const postRes = await fetch(`${BASE_URL}/api/paste`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: encrypted,
      openDiscussion: true,
    }),
  });
  const { id: pasteId } = await postRes.json();

  // Post Encrypted Comment
  const commentPayload = {
    text: 'Encrypted comment reply from Responder A',
    formatter: 'plaintext',
    language: 'SecOps-Alice',
  };
  const encComment = await encryptSecret(commentPayload, masterKey);

  const commentRes = await fetch(`${BASE_URL}/api/paste/${pasteId}/comment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: {
        ct: encComment.ct,
        iv: encComment.iv,
        salt: encComment.salt,
        adata: encComment.adata,
      },
    }),
  });
  assert.equal(commentRes.status, 201);

  // Read Paste + Comments
  const fetchRes = await fetch(`${BASE_URL}/api/paste/${pasteId}`);
  const pasteData = await fetchRes.json();
  assert.equal(pasteData.comments.length, 1);

  // Decrypt comment
  const decComment = await decryptSecret(
    {
      v: 2,
      ct: pasteData.comments[0].payload.ct,
      iv: pasteData.comments[0].payload.iv,
      salt: pasteData.comments[0].payload.salt,
      adata: pasteData.comments[0].payload.adata,
    },
    masterKey
  );
  assert.equal(decComment.text, commentPayload.text);
  assert.equal(decComment.language, 'SecOps-Alice');
});

test('E2E: Inbound Request-a-Secret Drop Flow (RSA-OAEP Asymmetric)', async () => {
  // 1. Requester creates drop with public key
  const keypair = await generateAsymmetricDropKeys();
  const dropRes = await fetch(`${BASE_URL}/api/request-drop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'Please send API keys',
      publicKey: keypair.publicKey,
    }),
  });
  assert.equal(dropRes.status, 201);
  const { id: dropId } = await dropRes.json();

  // 2. Submitter fetches drop info
  const dropGet = await fetch(`${BASE_URL}/api/request-drop/${dropId}`);
  const dropInfo = await dropGet.json();
  assert.equal(dropInfo.status, 'pending');

  // 3. Submitter encrypts and submits secret
  const clientSecret = { text: 'SUBMITTER_API_SECRET_KEY_9999', formatter: 'plaintext' };
  const encryptedDrop = await encryptInboundDrop(clientSecret, dropInfo.publicKey);

  const submitRes = await fetch(`${BASE_URL}/api/request-drop/${dropId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ encryptedPayload: encryptedDrop }),
  });
  assert.equal(submitRes.status, 200);

  // 4. Requester polls, retrieves completed drop, and decrypts with private key
  const finalGet = await fetch(`${BASE_URL}/api/request-drop/${dropId}`);
  const completedDrop = await finalGet.json();
  assert.equal(completedDrop.status, 'completed');

  const decryptedInbound = await decryptInboundDrop(completedDrop.encryptedPayload, keypair.privateKey);
  assert.equal(decryptedInbound.text, clientSecret.text);
});

test('E2E: Real-Time WebSocket E2EE Incident War Room Blind Relay', async () => {
  const roomId = 'room-' + Math.random().toString(36).substring(2, 8);
  const roomKey = generateMasterKey();

  const wsUrl = `ws://localhost:${PORT}/ws/incident-room?room=${roomId}`;
  const client1 = new WebSocket(wsUrl);
  const client2 = new WebSocket(wsUrl);

  await new Promise((resolve) => {
    let connected = 0;
    client1.on('open', () => { if (++connected === 2) resolve(true); });
    client2.on('open', () => { if (++connected === 2) resolve(true); });
  });

  // Client 1 sends encrypted message to Client 2
  const chatSecret = { text: 'INCIDENT_UPDATE: Firewall rule updated', formatter: 'plaintext' };
  const encryptedChat = await encryptSecret(chatSecret, roomKey);

  const receivedPromise = new Promise((resolve) => {
    client2.on('message', async (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'chat') {
        const dec = await decryptSecret(msg.payload, roomKey);
        resolve(dec.text);
      }
    });
  });

  client1.send(JSON.stringify({ type: 'chat', payload: encryptedChat }));

  const receivedText = await receivedPromise;
  assert.equal(receivedText, chatSecret.text);

  client1.close();
  client2.close();
});

test('E2E: Multi-Recipient Envelopes -> Per-Slot Read -> Per-Slot Burn -> Admin Telemetry -> Selective Revocation', async () => {
  const secretContent = {
    text: 'MULTI_RECIPIENT_DATABASE_URL=postgresql://root:secret@prod-db.internal:5432/app',
    formatter: 'env',
  };

  const recipients = [
    { label: 'Alice (Ops)', burnOnRead: true },
    { label: 'Bob (Lead)', burnOnRead: false },
    { label: 'Charlie (Audit)', burnOnRead: true },
  ];

  // 1. Encrypt multi-recipient secret
  const multiEncrypted = await encryptMultiRecipientSecret(secretContent, recipients);

  // 2. Post to API
  const postRes = await fetch(`${BASE_URL}/api/paste`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: multiEncrypted.payload,
      isMultiRecipient: true,
      envelopes: multiEncrypted.envelopes,
      adminTokenHash: multiEncrypted.adminTokenHash,
      expireInSeconds: 3600,
      burnAfterReading: false,
    }),
  });

  assert.equal(postRes.status, 201);
  const { id: pasteId } = await postRes.json();

  const aliceSlot = multiEncrypted.recipientSecrets[0];
  const bobSlot = multiEncrypted.recipientSecrets[1];
  const charlieSlot = multiEncrypted.recipientSecrets[2];

  // 3. Alice accesses her slot (Burn on read = true)
  const aliceGet = await fetch(`${BASE_URL}/api/paste/${pasteId}?slot=${aliceSlot.slotId}`);
  assert.equal(aliceGet.status, 200);
  const aliceData = await aliceGet.json();
  assert.equal(aliceData.activeSlot.slotId, aliceSlot.slotId);

  const aliceDecrypted = await decryptMultiRecipientSecret(
    aliceData.payload,
    aliceData.activeSlot,
    aliceSlot.slotKey
  );
  assert.equal(aliceDecrypted.text, secretContent.text);

  // Alice attempts to access her slot a 2nd time -> should be 410 Gone (Slot Burned)
  const aliceSecondGet = await fetch(`${BASE_URL}/api/paste/${pasteId}?slot=${aliceSlot.slotId}`);
  assert.equal(aliceSecondGet.status, 410, 'Alice burned slot must return 410 Gone on second read');

  // 4. Bob accesses his slot (Burn on read = false) -> Still active!
  const bobGet = await fetch(`${BASE_URL}/api/paste/${pasteId}?slot=${bobSlot.slotId}`);
  assert.equal(bobGet.status, 200, 'Bob slot must remain accessible');
  const bobData = await bobGet.json();
  const bobDecrypted = await decryptMultiRecipientSecret(
    bobData.payload,
    bobData.activeSlot,
    bobSlot.slotKey
  );
  assert.equal(bobDecrypted.text, secretContent.text);

  // Bob accesses a second time -> Still 200 OK because burnOnRead is false
  const bobSecondGet = await fetch(`${BASE_URL}/api/paste/${pasteId}?slot=${bobSlot.slotId}`);
  assert.equal(bobSecondGet.status, 200, 'Bob slot should not burn on read');

  // 5. Creator checks Admin Telemetry
  const adminTokenHash = await hashSha256(multiEncrypted.adminToken);
  const adminGet = await fetch(`${BASE_URL}/api/paste/${pasteId}/admin?tokenHash=${encodeURIComponent(adminTokenHash)}`);
  assert.equal(adminGet.status, 200);
  const adminStatus = await adminGet.json();
  assert.equal(adminStatus.envelopes.length, 3);
  
  const aliceAdminSlot = adminStatus.envelopes.find(e => e.slotId === aliceSlot.slotId);
  assert.equal(aliceAdminSlot.burned, true, 'Admin telemetry must report Alice as burned');
  assert.ok(aliceAdminSlot.readAt !== null, 'Admin telemetry must record read timestamp');

  const bobAdminSlot = adminStatus.envelopes.find(e => e.slotId === bobSlot.slotId);
  assert.equal(bobAdminSlot.burned, false, 'Bob should not be burned');
  assert.ok(bobAdminSlot.readAt !== null, 'Bob read timestamp must be recorded');

  const charlieAdminSlot = adminStatus.envelopes.find(e => e.slotId === charlieSlot.slotId);
  assert.equal(charlieAdminSlot.burned, false, 'Charlie is pending (not yet read)');
  assert.equal(charlieAdminSlot.readAt, null);

  // 6. Creator selectively revokes Charlie before Charlie opens his link
  const revokeRes = await fetch(`${BASE_URL}/api/paste/${pasteId}/slot/${charlieSlot.slotId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tokenHash: adminTokenHash }),
  });
  assert.equal(revokeRes.status, 200);

  // Charlie now attempts to open his link -> 410 Gone / Revoked
  const charlieGet = await fetch(`${BASE_URL}/api/paste/${pasteId}?slot=${charlieSlot.slotId}`);
  assert.equal(charlieGet.status, 410, 'Revoked slot must return 410');

  // Bob is still accessible!
  const bobThirdGet = await fetch(`${BASE_URL}/api/paste/${pasteId}?slot=${bobSlot.slotId}`);
  assert.equal(bobThirdGet.status, 200);
});

