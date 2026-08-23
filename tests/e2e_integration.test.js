/**
 * CipherDrop Full End-to-End Integration & API Verification Suite
 * Tests REST Endpoints, WebSocket Blind Relay, Duress Mode, Inbound Drops, Burn Lifecycles
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import {
  generateMasterKey,
  encryptSecret,
  decryptSecret,
  generateAsymmetricDropKeys,
  encryptInboundDrop,
  decryptInboundDrop,
} from '../src/crypto/webcrypto.ts';

const BASE_URL = 'http://localhost:3001';

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

  const wsUrl = `ws://localhost:3001/ws/incident-room?room=${roomId}`;
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
