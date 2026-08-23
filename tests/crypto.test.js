/**
 * CipherDrop Automated Cryptographic Verification Test Suite
 * Tests AES-256-GCM, PBKDF2 600k, Duress Decoy, Asymmetric Drops, and Base58/Base64
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateMasterKey,
  encryptSecret,
  decryptSecret,
  generateAsymmetricDropKeys,
  encryptInboundDrop,
  decryptInboundDrop,
  bytesToBase58,
  base58ToBytes,
  bytesToBase64Url,
  base64UrlToBytes,
  zeroize
} from '../src/crypto/webcrypto.ts';

test('Base64URL and Base58 Encoding Invariants', () => {
  const originalBytes = new Uint8Array([0, 15, 255, 128, 42, 100, 200, 18]);
  
  // Base64URL
  const b64 = bytesToBase64Url(originalBytes);
  const decodedB64 = base64UrlToBytes(b64);
  assert.deepEqual(decodedB64, originalBytes, 'Base64URL round-trip should match exactly');

  // Base58
  const b58 = bytesToBase58(originalBytes);
  const decodedB58 = base58ToBytes(b58);
  assert.deepEqual(decodedB58, originalBytes, 'Base58 round-trip should match exactly');
});

test('Master Key Generation Entropy', () => {
  const key1 = generateMasterKey();
  const key2 = generateMasterKey();
  assert.notEqual(key1, key2, 'Keys generated must be unique');
  assert.ok(key1.length >= 40, 'Base58 master key must have sufficient length');
});

test('AES-256-GCM Zero-Knowledge Secret Encryption & Decryption (No Password)', async () => {
  const masterKey = generateMasterKey();
  const payload = {
    text: 'CONFIDENTIAL: AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE',
    formatter: 'env',
    commentsAllowed: true,
  };

  const encrypted = await encryptSecret(payload, masterKey);
  assert.ok(encrypted.ct, 'Must contain ciphertext');
  assert.ok(encrypted.iv, 'Must contain IV');
  assert.equal(encrypted.v, 2, 'Version must be 2');

  const decrypted = await decryptSecret(encrypted, masterKey);
  assert.equal(decrypted.text, payload.text);
  assert.equal(decrypted.formatter, payload.formatter);
  assert.equal(decrypted.isDecoy, undefined);
});

test('AES-256-GCM + PBKDF2 Password Protection', async () => {
  const masterKey = generateMasterKey();
  const password = 'SuperSecureSecretPassword!2026';
  const payload = {
    text: 'Top Secret Whistleblower Document Text',
    formatter: 'markdown',
  };

  const encrypted = await encryptSecret(payload, masterKey, { password });
  assert.ok(encrypted.salt, 'Must contain salt for password derivation');

  // Successful decryption with correct password
  const decrypted = await decryptSecret(encrypted, masterKey, password);
  assert.equal(decrypted.text, payload.text);

  // Failed decryption with wrong password
  await assert.rejects(
    async () => {
      await decryptSecret(encrypted, masterKey, 'WrongPassword123');
    },
    /Decryption failed/,
    'Decryption with wrong password must throw error'
  );
});

test('Duress / Decoy Mode (Plausible Deniability)', async () => {
  const masterKey = generateMasterKey();
  const primaryPassword = 'RealPassword#999';
  const duressPassword = 'CoercedPassword#111';

  const realSecret = {
    text: 'REAL_BITCOIN_SEED_PHRASE: apple banana cat dog elephant fox gorilla hotel',
    formatter: 'plaintext',
  };

  const decoySecret = {
    text: 'DECOY_MOCK_KEYS: STRIPE_TEST_KEY=pk_test_51MockKeyForAttacker',
    formatter: 'plaintext',
  };

  const encrypted = await encryptSecret(realSecret, masterKey, {
    password: primaryPassword,
    duressPassword: duressPassword,
    decoyData: decoySecret,
  });

  assert.ok(encrypted.duress?.enabled, 'Duress container must be enabled');
  assert.ok(encrypted.duress?.decoyCt, 'Must contain decoy ciphertext');

  // Case 1: Recipient enters Real Password -> Gets Real Secret
  const realDecrypted = await decryptSecret(encrypted, masterKey, primaryPassword);
  assert.equal(realDecrypted.text, realSecret.text);
  assert.ok(!realDecrypted.isDecoy, 'Should not be marked as decoy');

  // Case 2: Coerced User enters Duress Password -> Seamlessly Gets Decoy Secret
  const decoyDecrypted = await decryptSecret(encrypted, masterKey, duressPassword);
  assert.equal(decoyDecrypted.text, decoySecret.text);
  assert.equal(decoyDecrypted.isDecoy, true, 'Should be marked as decoy');
});

test('Inbound Drop Asymmetric Key Exchange (RSA-OAEP + AES-GCM)', async () => {
  // 1. Requester generates keypair
  const keys = await generateAsymmetricDropKeys();
  assert.ok(keys.publicKey, 'Must have public key');
  assert.ok(keys.privateKey, 'Must have private key');

  // 2. Submitter encrypts payload with Public Key
  const secretFromClient = {
    text: 'CLIENT_PRODUCTION_DATABASE_URL=postgres://user:pass@db.prod.internal:5432/main',
    formatter: 'env',
  };
  const encryptedDrop = await encryptInboundDrop(secretFromClient, keys.publicKey);

  assert.ok(encryptedDrop.encryptedKey, 'Must have RSA encrypted session key');
  assert.ok(encryptedDrop.ct, 'Must have AES ciphertext');

  // 3. Requester decrypts with Private Key
  const decryptedDrop = await decryptInboundDrop(encryptedDrop, keys.privateKey);
  assert.equal(decryptedDrop.text, secretFromClient.text);
  assert.equal(decryptedDrop.formatter, secretFromClient.formatter);
});

test('Memory Zeroization Hygiene', () => {
  const sensitiveBuffer = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  zeroize(sensitiveBuffer);
  assert.ok(sensitiveBuffer.every(byte => byte === 0), 'Buffer should be completely zeroed out');
});
