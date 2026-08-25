/**
 * CipherDrop Sovereign Cryptographic Engine
 * Zero-Knowledge Native WebCrypto Architecture
 * Algorithms: AES-256-GCM, Argon2id (OWASP standard, 64MB memory-hard), PBKDF2-SHA256 (600k iterations fallback),
 * Shamir's Secret Sharing (M-of-N Quorum), RSA-OAEP 2048 / ECDH, Leak-Traceable Zero-Width Watermarking
 */

import { argon2id } from 'hash-wasm';
import { split, combine } from 'shamir-secret-sharing';
import { KdfType } from '../types';

// Base58 Character Set (Bitcoin alphabet - removes 0, O, I, l to prevent visual ambiguity)
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export interface EncryptedPayload {
  v: number;                 // CipherDrop format version (2)
  ct: string;                // Base64URL ciphertext
  iv: string;                // Base64URL initialization vector (96-bit)
  salt?: string;             // Base64URL salt for PBKDF2/Argon2id (if password protected)
  iterations?: number;       // PBKDF2 iterations (default: 600,000)
  kdf?: KdfType;             // Key Derivation Function: 'argon2id' (OWASP default) | 'pbkdf2'
  memorySize?: number;       // Memory size in KB for Argon2id (default: 65536 = 64MB)
  adata?: string;            // Authenticated data string bound to GCM tag
  duress?: {                 // Plausible deniability decoy container (optional)
    enabled: boolean;
    decoyCt: string;
    decoyIv: string;
    decoySalt: string;
    decoyKdf?: KdfType;
  };
  quorum?: {
    threshold: number;
    totalShares: number;
  };
  watermarked?: boolean;
}

export interface DecryptedResult {
  text: string;
  formatter: 'plaintext' | 'code' | 'markdown' | 'env';
  language?: string;
  isDecoy?: boolean;
  attachment?: {
    name: string;
    type: string;
    size: number;
    data: string; // Base64 data URL
  };
  commentsAllowed?: boolean;
  watermarkFingerprint?: string;
}

export interface AsymmetricKeyPair {
  publicKey: string;
  privateKey: string;
}

/**
 * Convert Uint8Array to Base64URL string (RFC 4648 §5)
 */
export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Convert Base64URL string to Uint8Array
 */
export function base64UrlToBytes(base64url: string): Uint8Array {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encode Uint8Array to Base58 string
 */
export function bytesToBase58(bytes: Uint8Array): string {
  const digits = [0];
  for (let i = 0; i < bytes.length; i++) {
    for (let j = 0; j < digits.length; j++) digits[j] <<= 8;
    digits[0] += bytes[i];
    let carry = 0;
    for (let j = 0; j < digits.length; j++) {
      digits[j] += carry;
      carry = (digits[j] / 58) | 0;
      digits[j] %= 58;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let res = '';
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
    res += '1';
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    res += BASE58_ALPHABET[digits[i]];
  }
  return res;
}

/**
 * Decode Base58 string to Uint8Array
 */
export function base58ToBytes(str: string): Uint8Array {
  if (str.length === 0) return new Uint8Array(0);
  const bytes = [0];
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    const value = BASE58_ALPHABET.indexOf(c);
    if (value === -1) throw new Error(`Invalid Base58 character: ${c}`);
    for (let j = 0; j < bytes.length; j++) bytes[j] *= 58;
    bytes[0] += value;
    let carry = 0;
    for (let j = 0; j < bytes.length; j++) {
      bytes[j] += carry;
      carry = bytes[j] >> 8;
      bytes[j] &= 0xff;
    }
    while (carry) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (let i = 0; i < str.length && str[i] === '1'; i++) {
    bytes.push(0);
  }
  return new Uint8Array(bytes.reverse());
}

/**
 * Zeroize memory buffer (cryptographic hygiene)
 */
export function zeroize(buffer: Uint8Array | ArrayBuffer): void {
  const view = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  crypto.getRandomValues(view);
  view.fill(0);
}

/**
 * Generate 256-bit cryptographically secure random symmetric master key
 */
export function generateMasterKey(): string {
  const keyBytes = new Uint8Array(32);
  crypto.getRandomValues(keyBytes);
  return bytesToBase58(keyBytes);
}

/**
 * Derive AES-GCM 256-bit key from Master Key + optional Password using Argon2id (OWASP recommended) or PBKDF2-SHA256
 */
export async function deriveAesKey(
  masterKeyBase58: string,
  password?: string,
  saltBytes?: Uint8Array,
  iterations: number = 600000,
  kdf: KdfType = 'argon2id',
  memorySize: number = 65536
): Promise<CryptoKey> {
  const masterKeyBytes = base58ToBytes(masterKeyBase58);
  const encoder = new TextEncoder();
  const hasPassword = Boolean(password && password.trim().length > 0);

  let rawMaterial: Uint8Array;
  if (hasPassword) {
    const passwordBytes = encoder.encode(password!.trim());
    rawMaterial = new Uint8Array(masterKeyBytes.length + passwordBytes.length);
    rawMaterial.set(masterKeyBytes, 0);
    rawMaterial.set(passwordBytes, masterKeyBytes.length);
  } else {
    rawMaterial = masterKeyBytes;
  }

  const finalSalt = saltBytes || new Uint8Array(16);

  // Use memory-hard Argon2id when password protection is active and kdf is argon2id
  if (hasPassword && kdf === 'argon2id') {
    try {
      const derivedKeyBinary = await argon2id({
        password: rawMaterial,
        salt: finalSalt,
        parallelism: 1,
        iterations: 3,
        memorySize: memorySize || 65536, // 64 MB
        hashLength: 32,
        outputType: 'binary',
      });

      const aesKey = await crypto.subtle.importKey(
        'raw',
        derivedKeyBinary as unknown as BufferSource,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );

      zeroize(rawMaterial);
      zeroize(derivedKeyBinary);
      return aesKey;
    } catch (argonErr) {
      console.warn('Argon2id WASM failed, falling back to PBKDF2:', argonErr);
      // Fallback to PBKDF2 if Argon2id WASM execution fails in an unsupported environment
    }
  }

  // PBKDF2 derivation (default for high-entropy master key or PBKDF2 password mode)
  const baseKey = await crypto.subtle.importKey(
    'raw',
    rawMaterial as unknown as BufferSource,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: finalSalt as unknown as BufferSource,
      iterations: iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  zeroize(rawMaterial);
  return aesKey;
}

/**
 * Encrypt Secret Payload using AES-256-GCM with optional Password (Argon2id/PBKDF2) & Duress Decoy
 */
export async function encryptSecret(
  data: DecryptedResult,
  masterKey: string,
  options?: {
    password?: string;
    duressPassword?: string;
    decoyData?: DecryptedResult;
    authenticatedMeta?: string;
    kdf?: KdfType;
    memorySize?: number;
  }
): Promise<EncryptedPayload> {
  const encoder = new TextEncoder();
  const iterations = 600000;
  const kdfChoice = options?.kdf || 'argon2id';
  const memorySize = options?.memorySize || 65536;
  const hasPassword = Boolean(options?.password && options.password.trim().length > 0);

  // Primary salt & IV
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);

  const primaryKey = await deriveAesKey(
    masterKey,
    options?.password,
    salt,
    iterations,
    kdfChoice,
    memorySize
  );

  const serialized = JSON.stringify(data);
  const plaintextBuffer = encoder.encode(serialized);

  const adataString = options?.authenticatedMeta || 'cipherdrop-v2';
  const adataBytes = encoder.encode(adataString);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
      additionalData: adataBytes as unknown as BufferSource,
      tagLength: 128,
    },
    primaryKey,
    plaintextBuffer as unknown as BufferSource
  );

  const result: EncryptedPayload = {
    v: 2,
    ct: bytesToBase64Url(new Uint8Array(ciphertextBuffer)),
    iv: bytesToBase64Url(iv),
    salt: bytesToBase64Url(salt),
    iterations: iterations,
    kdf: hasPassword ? kdfChoice : undefined,
    memorySize: hasPassword && kdfChoice === 'argon2id' ? memorySize : undefined,
    adata: adataString,
  };

  // Coercion Resistance: Handle Duress / Decoy Payload
  if (options?.duressPassword && options.duressPassword.trim().length > 0 && options?.decoyData) {
    const decoySalt = new Uint8Array(16);
    crypto.getRandomValues(decoySalt);
    const decoyIv = new Uint8Array(12);
    crypto.getRandomValues(decoyIv);

    const decoyKey = await deriveAesKey(
      masterKey,
      options.duressPassword,
      decoySalt,
      iterations,
      kdfChoice,
      memorySize
    );
    const decoyBuffer = encoder.encode(JSON.stringify({ ...options.decoyData, isDecoy: true }));

    const decoyCiphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: decoyIv as unknown as BufferSource,
        additionalData: adataBytes as unknown as BufferSource,
        tagLength: 128,
      },
      decoyKey,
      decoyBuffer as unknown as BufferSource
    );

    result.duress = {
      enabled: true,
      decoyCt: bytesToBase64Url(new Uint8Array(decoyCiphertext)),
      decoyIv: bytesToBase64Url(decoyIv),
      decoySalt: bytesToBase64Url(decoySalt),
      decoyKdf: kdfChoice,
    };
  }

  return result;
}

/**
 * Decrypt Secret Payload using AES-256-GCM. Seamlessly handles Argon2id, PBKDF2, Primary & Duress Decoy passwords.
 */
export async function decryptSecret(
  payload: EncryptedPayload,
  masterKey: string,
  password?: string
): Promise<DecryptedResult> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const adataString = payload.adata || 'cipherdrop-v2';
  const adataBytes = encoder.encode(adataString);
  const iterations = payload.iterations || 600000;
  const kdf = payload.kdf || (payload.iterations ? 'pbkdf2' : 'argon2id');
  const memorySize = payload.memorySize || 65536;

  // 1. Try decrypting primary payload
  try {
    const saltBytes = payload.salt ? base64UrlToBytes(payload.salt) : new Uint8Array(16);
    const ivBytes = base64UrlToBytes(payload.iv);
    const ctBytes = base64UrlToBytes(payload.ct);

    const aesKey = await deriveAesKey(masterKey, password, saltBytes, iterations, kdf, memorySize);

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBytes as unknown as BufferSource,
        additionalData: adataBytes as unknown as BufferSource,
        tagLength: 128,
      },
      aesKey,
      ctBytes as unknown as BufferSource
    );

    const decryptedJson = decoder.decode(decryptedBuffer);
    return JSON.parse(decryptedJson);
  } catch (primaryErr) {
    // 2. If primary decryption fails, check if a duress decoy container exists and try decrypting with the password
    if (payload.duress?.enabled && payload.duress.decoyCt && password) {
      try {
        const decoySaltBytes = base64UrlToBytes(payload.duress.decoySalt);
        const decoyIvBytes = base64UrlToBytes(payload.duress.decoyIv);
        const decoyCtBytes = base64UrlToBytes(payload.duress.decoyCt);
        const decoyKdf = payload.duress.decoyKdf || kdf;

        const decoyKey = await deriveAesKey(masterKey, password, decoySaltBytes, iterations, decoyKdf, memorySize);

        const decryptedDecoyBuffer = await crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: decoyIvBytes as unknown as BufferSource,
            additionalData: adataBytes as unknown as BufferSource,
            tagLength: 128,
          },
          decoyKey,
          decoyCtBytes as unknown as BufferSource
        );

        const decryptedDecoyJson = decoder.decode(decryptedDecoyBuffer);
        const decoyResult = JSON.parse(decryptedDecoyJson);
        decoyResult.isDecoy = true;
        return decoyResult;
      } catch (decoyErr) {
        // Both primary and decoy failed
        throw new Error('Decryption failed. Invalid password or corrupted secret.');
      }
    }

    throw new Error('Decryption failed. Invalid password or corrupted secret.');
  }
}

/**
 * Generate Ephemeral Asymmetric Key Pair (RSA-OAEP 2048-bit) for Inbound Secret Drops
 */
export async function generateAsymmetricDropKeys(): Promise<AsymmetricKeyPair> {
  const keyPair = (await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    } as RsaHashedKeyGenParams,
    true,
    ['encrypt', 'decrypt']
  )) as CryptoKeyPair;

  const exportedPublic = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const exportedPrivate = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

  return {
    publicKey: bytesToBase64Url(new Uint8Array(exportedPublic)),
    privateKey: bytesToBase64Url(new Uint8Array(exportedPrivate)),
  };
}

/**
 * Encrypt a secret using the Inbound Drop Public Key (RSA-OAEP + AES-GCM hybrid)
 */
export async function encryptInboundDrop(
  data: DecryptedResult,
  publicKeyBase64Url: string
): Promise<{ encryptedKey: string; iv: string; ct: string }> {
  const encoder = new TextEncoder();
  const publicKeyBytes = base64UrlToBytes(publicKeyBase64Url);

  const publicKey = await crypto.subtle.importKey(
    'spki',
    publicKeyBytes as unknown as BufferSource,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );

  // Generate ephemeral AES-256 session key
  const sessionKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const exportedSessionKey = await crypto.subtle.exportKey('raw', sessionKey);

  // Encrypt the session key with RSA-OAEP public key
  const encryptedSessionKey = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    exportedSessionKey
  );

  // Encrypt payload with AES-GCM
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const payloadBytes = encoder.encode(JSON.stringify(data));

  const encryptedPayload = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource, tagLength: 128 },
    sessionKey,
    payloadBytes as unknown as BufferSource
  );

  return {
    encryptedKey: bytesToBase64Url(new Uint8Array(encryptedSessionKey)),
    iv: bytesToBase64Url(iv),
    ct: bytesToBase64Url(new Uint8Array(encryptedPayload)),
  };
}

/**
 * Decrypt an Inbound Drop secret using the Requester's Private Key
 */
export async function decryptInboundDrop(
  dropPayload: { encryptedKey: string; iv: string; ct: string },
  privateKeyBase64Url: string
): Promise<DecryptedResult> {
  const decoder = new TextDecoder();
  const privateKeyBytes = base64UrlToBytes(privateKeyBase64Url);

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBytes as unknown as BufferSource,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt']
  );

  const encryptedKeyBytes = base64UrlToBytes(dropPayload.encryptedKey);
  const rawSessionKey = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    encryptedKeyBytes as unknown as BufferSource
  );

  const sessionKey = await crypto.subtle.importKey(
    'raw',
    rawSessionKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const ivBytes = base64UrlToBytes(dropPayload.iv);
  const ctBytes = base64UrlToBytes(dropPayload.ct);

  const decryptedPayload = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes as unknown as BufferSource, tagLength: 128 },
    sessionKey,
    ctBytes as unknown as BufferSource
  );

  return JSON.parse(decoder.decode(decryptedPayload));
}

/**
 * Compute SHA-256 hash of a string (returns Base64URL)
 */
export async function hashSha256(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return bytesToBase64Url(new Uint8Array(hashBuffer));
}

// ----------------------------------------------------------------------------
// SHAMIR'S SECRET SHARING (M-of-N Quorum Unlock)
// ----------------------------------------------------------------------------

/**
 * Split Content Encryption Key (CEK) into N shares with threshold M
 */
export async function splitCekToQuorumShares(
  cekBase58: string,
  totalShares: number,
  threshold: number
): Promise<string[]> {
  if (threshold > totalShares) {
    throw new Error('Threshold M cannot exceed total shares N.');
  }
  if (threshold < 2) {
    throw new Error('Threshold M must be at least 2 for quorum unlock.');
  }
  const cekBytes = base58ToBytes(cekBase58);
  const shares = await split(cekBytes, totalShares, threshold);
  return shares.map(s => bytesToBase58(s));
}

/**
 * Combine M shares to reconstruct the Content Encryption Key (CEK)
 */
export async function combineQuorumSharesToCek(
  shareStrings: string[]
): Promise<string> {
  if (!shareStrings || shareStrings.length === 0) {
    throw new Error('No shares provided for quorum reconstruction.');
  }

  const shareBytesArray: Uint8Array[] = [];
  for (const str of shareStrings) {
    const trimmed = str.trim();
    if (!trimmed) continue;
    try {
      shareBytesArray.push(base58ToBytes(trimmed));
    } catch {
      shareBytesArray.push(base64UrlToBytes(trimmed));
    }
  }

  if (shareBytesArray.length === 0) {
    throw new Error('Invalid or empty shares.');
  }

  const recoveredBytes = await combine(shareBytesArray);
  return bytesToBase58(recoveredBytes);
}

export interface QuorumGenerated {
  payload: EncryptedPayload;
  threshold: number;
  totalShares: number;
  shares: Array<{
    shareIndex: number;
    shareKey: string;
    label: string;
  }>;
}

/**
 * Encrypt secret with Quorum Unlock (M-of-N Shamir Secret Sharing)
 */
export async function encryptQuorumSecret(
  data: DecryptedResult,
  threshold: number,
  totalSharesOrTrustees: number | Array<{ label: string } | string>,
  trusteeLabels?: string[],
  options?: {
    password?: string;
    duressPassword?: string;
    decoyData?: DecryptedResult;
    authenticatedMeta?: string;
    kdf?: KdfType;
  }
): Promise<QuorumGenerated> {
  let totalShares: number;
  let labels: string[];

  if (Array.isArray(totalSharesOrTrustees)) {
    totalShares = totalSharesOrTrustees.length;
    labels = totalSharesOrTrustees.map(t => typeof t === 'string' ? t : t.label);
  } else {
    totalShares = totalSharesOrTrustees;
    labels = trusteeLabels || [];
  }

  const masterCEK = generateMasterKey();
  const payload = await encryptSecret(data, masterCEK, {
    password: options?.password,
    duressPassword: options?.duressPassword,
    decoyData: options?.decoyData,
    authenticatedMeta: options?.authenticatedMeta || 'cipherdrop-v2-quorum',
    kdf: options?.kdf || 'argon2id',
  });

  payload.quorum = {
    threshold,
    totalShares,
  };

  const shareKeys = await splitCekToQuorumShares(masterCEK, totalShares, threshold);
  const shares = shareKeys.map((shareKey, idx) => ({
    shareIndex: idx + 1,
    shareKey,
    label: labels[idx] || `Trustee ${idx + 1}`,
  }));

  return {
    payload,
    threshold,
    totalShares,
    shares,
  };
}

// ----------------------------------------------------------------------------
// LEAK-TRACEABLE ENVELOPE WATERMARKING
// ----------------------------------------------------------------------------

/**
 * Convert a slot ID into a 32-bit deterministic fingerprint bitstream
 */
export async function getSlotWatermarkBits(slotId: string): Promise<string> {
  const hash = await hashSha256(slotId);
  let bits = '';
  for (let i = 0; i < hash.length && bits.length < 32; i++) {
    const charCode = hash.charCodeAt(i);
    bits += (charCode & 1).toString();
  }
  while (bits.length < 32) bits += '0';
  return bits.slice(0, 32);
}

/**
 * Embed invisible zero-width watermark into text keyed to recipient slotId
 * ZWSP (\u200B) = 0, ZWNJ (\u200C) = 1, ZWJ (\u200D) = Framing delimiter
 */
export async function embedWatermark(text: string, slotId: string): Promise<string> {
  const bits = await getSlotWatermarkBits(slotId);
  const ZWSP = '\u200B'; // 0
  const ZWNJ = '\u200C'; // 1
  const ZWJ = '\u200D';  // Framing delimiter

  let watermarkStream = ZWJ;
  for (const bit of bits) {
    watermarkStream += bit === '1' ? ZWNJ : ZWSP;
  }
  watermarkStream += ZWJ;

  if (!text || text.length === 0) return watermarkStream;

  const newlineIdx = text.indexOf('\n');
  if (newlineIdx !== -1) {
    return text.slice(0, newlineIdx) + watermarkStream + text.slice(newlineIdx);
  }
  const spaceIdx = text.indexOf(' ');
  if (spaceIdx !== -1) {
    return text.slice(0, spaceIdx) + watermarkStream + text.slice(spaceIdx);
  }
  return text + watermarkStream;
}

/**
 * Extract zero-width watermark bits from leaked or recovered text
 */
export function extractWatermark(text: string): string | null {
  if (!text) return null;
  const ZWSP = '\u200B';
  const ZWNJ = '\u200C';
  const ZWJ = '\u200D';

  const firstZWJ = text.indexOf(ZWJ);
  if (firstZWJ === -1) return null;
  const secondZWJ = text.indexOf(ZWJ, firstZWJ + 1);
  if (secondZWJ === -1) return null;

  const framed = text.slice(firstZWJ + 1, secondZWJ);
  let bits = '';
  for (const ch of framed) {
    if (ch === ZWSP) bits += '0';
    else if (ch === ZWNJ) bits += '1';
  }

  return bits.length > 0 ? bits : null;
}

/**
 * Forensically attribute leaked plaintext against a list of candidate recipient slots
 */
export async function attributeWatermark(
  leakedText: string,
  candidates: Array<{ slotId: string; label?: string } | string>
): Promise<{
  slotId: string;
  label: string;
  confidence: number;
  matchBits: number;
  totalBits: number;
} | null> {
  const extractedBits = extractWatermark(leakedText);
  if (!extractedBits) return null;

  const normalized = candidates.map(c =>
    typeof c === 'string' ? { slotId: c, label: c } : { slotId: c.slotId, label: c.label || c.slotId }
  );

  let bestMatch: { slotId: string; label: string; confidence: number; matchBits: number; totalBits: number } | null = null;
  let highestMatch = -1;

  for (const candidate of normalized) {
    const candidateBits = await getSlotWatermarkBits(candidate.slotId);
    let matches = 0;
    const len = Math.min(extractedBits.length, candidateBits.length);
    for (let i = 0; i < len; i++) {
      if (extractedBits[i] === candidateBits[i]) matches++;
    }
    const confidence = len > 0 ? matches / len : 0;
    if (matches > highestMatch) {
      highestMatch = matches;
      bestMatch = {
        slotId: candidate.slotId,
        label: candidate.label,
        confidence,
        matchBits: matches,
        totalBits: len,
      };
    }
  }

  return bestMatch;
}

// ----------------------------------------------------------------------------
// DIFFERENTIAL PRIVACY LAPLACE MECHANISM
// ----------------------------------------------------------------------------

/**
 * Generate Laplace noise for differential privacy: scale = sensitivity / epsilon
 */
export function laplaceNoise(scale: number): number {
  const u = Math.random() - 0.5;
  return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
}

/**
 * Apply epsilon-differential privacy to an integer query/count
 */
export function dpCount(trueCount: number, epsilon: number = 1.0, sensitivity: number = 1): number {
  if (epsilon <= 0) return trueCount;
  const scale = sensitivity / epsilon;
  const noise = laplaceNoise(scale);
  return Math.max(0, Math.round(trueCount + noise));
}

// ----------------------------------------------------------------------------
// MULTI-RECIPIENT ENVELOPE ENCRYPTION
// ----------------------------------------------------------------------------

export interface RecipientSlotConfig {
  label: string;
  burnOnRead?: boolean;
  password?: string;
}

export interface MultiRecipientGenerated {
  payload: EncryptedPayload;
  envelopes: Array<{
    slotId: string;
    label: string;
    wrappedKey: string;
    iv: string;
    salt?: string;
    kdf?: KdfType;
    burned: boolean;
    readAt: number | null;
    burnOnRead: boolean;
    watermarked?: boolean;
    slotPayload?: EncryptedPayload;
  }>;
  adminToken: string;
  adminTokenHash: string;
  recipientSecrets: Array<{
    slotId: string;
    label: string;
    slotKey: string;
    burnOnRead: boolean;
    hasPassword?: boolean;
    watermarked?: boolean;
  }>;
}

/**
 * Encrypt Secret for Multiple Recipients using Envelope Encryption with optional Watermarking
 */
export async function encryptMultiRecipientSecret(
  data: DecryptedResult,
  recipients: RecipientSlotConfig[],
  options?: {
    duressPassword?: string;
    decoyData?: DecryptedResult;
    authenticatedMeta?: string;
    watermarkEnvelopes?: boolean;
    kdf?: KdfType;
  }
): Promise<MultiRecipientGenerated> {
  const encoder = new TextEncoder();
  const kdfChoice = options?.kdf || 'argon2id';

  // 1. Generate Master Content Encryption Key (CEK)
  const masterCEK = generateMasterKey();

  // 2. Encrypt primary (and optional decoy) payload with master CEK
  const payload = await encryptSecret(data, masterCEK, {
    duressPassword: options?.duressPassword,
    decoyData: options?.decoyData,
    authenticatedMeta: options?.authenticatedMeta || 'cipherdrop-v2-envelope',
    kdf: kdfChoice,
  });

  if (options?.watermarkEnvelopes) {
    payload.watermarked = true;
  }

  // 3. Generate Creator Admin Revocation Token
  const adminToken = generateMasterKey();
  const adminTokenHash = await hashSha256(adminToken);

  const envelopes: MultiRecipientGenerated['envelopes'] = [];
  const recipientSecrets: MultiRecipientGenerated['recipientSecrets'] = [];

  // 4. Wrap master CEK (or watermarked slot payload) for each recipient
  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];
    const slotBytes = new Uint8Array(8);
    crypto.getRandomValues(slotBytes);
    const slotId = bytesToBase64Url(slotBytes);
    const slotKey = generateMasterKey();

    const slotSalt = new Uint8Array(16);
    crypto.getRandomValues(slotSalt);
    const slotIv = new Uint8Array(12);
    crypto.getRandomValues(slotIv);

    const slotAesKey = await deriveAesKey(slotKey, r.password, slotSalt, 600000, r.password ? kdfChoice : 'pbkdf2');
    const cekPlaintext = encoder.encode(masterCEK);
    const slotAdata = encoder.encode(`cipherdrop-envelope:${slotId}`);

    const wrappedKeyBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: slotIv as unknown as BufferSource,
        additionalData: slotAdata as unknown as BufferSource,
        tagLength: 128,
      },
      slotAesKey,
      cekPlaintext as unknown as BufferSource
    );

    let slotPayload: EncryptedPayload | undefined = undefined;
    if (options?.watermarkEnvelopes) {
      // Create recipient-specific watermarked payload encrypted with master CEK
      const watermarkedText = await embedWatermark(data.text, slotId);
      const watermarkedData: DecryptedResult = {
        ...data,
        text: watermarkedText,
        watermarkFingerprint: slotId,
      };
      slotPayload = await encryptSecret(watermarkedData, masterCEK, {
        authenticatedMeta: `cipherdrop-v2-envelope:${slotId}`,
        kdf: kdfChoice,
      });
    }

    envelopes.push({
      slotId,
      label: r.label || `Recipient ${i + 1}`,
      wrappedKey: bytesToBase64Url(new Uint8Array(wrappedKeyBuffer)),
      iv: bytesToBase64Url(slotIv),
      salt: bytesToBase64Url(slotSalt),
      kdf: r.password ? kdfChoice : undefined,
      burned: false,
      readAt: null,
      burnOnRead: Boolean(r.burnOnRead),
      watermarked: Boolean(options?.watermarkEnvelopes),
      slotPayload,
    });

    recipientSecrets.push({
      slotId,
      label: r.label || `Recipient ${i + 1}`,
      slotKey,
      burnOnRead: Boolean(r.burnOnRead),
      hasPassword: Boolean(r.password && r.password.trim().length > 0),
      watermarked: Boolean(options?.watermarkEnvelopes),
    });
  }

  return {
    payload,
    envelopes,
    adminToken,
    adminTokenHash,
    recipientSecrets,
  };
}

/**
 * Unwrap master CEK from a recipient envelope slot
 */
export async function unwrapRecipientEnvelope(
  envelope: {
    slotId: string;
    wrappedKey: string;
    iv: string;
    salt?: string;
    kdf?: KdfType;
  },
  slotKey: string,
  password?: string
): Promise<string> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const slotSaltBytes = envelope.salt ? base64UrlToBytes(envelope.salt) : new Uint8Array(16);
  const slotIvBytes = base64UrlToBytes(envelope.iv);
  const wrappedKeyBytes = base64UrlToBytes(envelope.wrappedKey);
  const slotAdata = encoder.encode(`cipherdrop-envelope:${envelope.slotId}`);
  const kdf = envelope.kdf || 'pbkdf2';

  const slotAesKey = await deriveAesKey(slotKey, password, slotSaltBytes, 600000, kdf);

  const unwrappedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: slotIvBytes as unknown as BufferSource,
      additionalData: slotAdata as unknown as BufferSource,
      tagLength: 128,
    },
    slotAesKey,
    wrappedKeyBytes as unknown as BufferSource
  );

  return decoder.decode(unwrappedBuffer);
}

/**
 * Decrypt a Multi-Recipient Secret using a Recipient Slot Envelope
 */
export async function decryptMultiRecipientSecret(
  payload: EncryptedPayload,
  envelope: {
    slotId: string;
    wrappedKey: string;
    iv: string;
    salt?: string;
    kdf?: KdfType;
    slotPayload?: EncryptedPayload;
  },
  slotKey: string,
  password?: string
): Promise<DecryptedResult> {
  // 1. Unwrap the master CEK from the envelope using slotKey (+ optional slot passphrase)
  const masterCEK = await unwrapRecipientEnvelope(envelope, slotKey, password);

  // 2. If envelope contains a slot-specific watermarked payload, decrypt that; otherwise decrypt the main payload
  const targetPayload = envelope.slotPayload || payload;

  try {
    return await decryptSecret(targetPayload, masterCEK);
  } catch (err) {
    if (password) {
      return await decryptSecret(targetPayload, masterCEK, password);
    }
    throw err;
  }
}


