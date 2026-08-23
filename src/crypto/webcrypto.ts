/**
 * CipherDrop Sovereign Cryptographic Engine
 * Zero-Knowledge Native WebCrypto Architecture
 * Algorithms: AES-256-GCM, PBKDF2-SHA256 (600k iterations), RSA-OAEP / ECDH
 */

// Base58 Character Set (Bitcoin alphabet - removes 0, O, I, l to prevent visual ambiguity)
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export interface EncryptedPayload {
  v: number;                 // CipherDrop format version (2)
  ct: string;                // Base64URL ciphertext
  iv: string;                // Base64URL initialization vector (96-bit)
  salt?: string;             // Base64URL salt for PBKDF2 (if password protected)
  iterations?: number;       // PBKDF2 iterations (default: 600,000)
  adata?: string;            // Authenticated data string bound to GCM tag
  duress?: {                 // Plausible deniability decoy container (optional)
    enabled: boolean;
    decoyCt: string;
    decoyIv: string;
    decoySalt: string;
  };
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
 * Derive AES-GCM 256-bit key from Master Key + optional Password using PBKDF2-SHA256
 */
async function deriveAesKey(
  masterKeyBase58: string,
  password?: string,
  saltBytes?: Uint8Array,
  iterations: number = 600000
): Promise<CryptoKey> {
  const masterKeyBytes = base58ToBytes(masterKeyBase58);
  const encoder = new TextEncoder();
  
  let rawMaterial: Uint8Array;
  if (password && password.trim().length > 0) {
    const passwordBytes = encoder.encode(password.trim());
    rawMaterial = new Uint8Array(masterKeyBytes.length + passwordBytes.length);
    rawMaterial.set(masterKeyBytes, 0);
    rawMaterial.set(passwordBytes, masterKeyBytes.length);
  } else {
    rawMaterial = masterKeyBytes;
  }

  // Import raw key material for derivation
  const baseKey = await crypto.subtle.importKey(
    'raw',
    rawMaterial as unknown as BufferSource,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // PBKDF2 key stretching
  const finalSalt = saltBytes || new Uint8Array(16);
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
 * Encrypt Secret Payload using AES-256-GCM with optional Password & Duress Decoy
 */
export async function encryptSecret(
  data: DecryptedResult,
  masterKey: string,
  options?: {
    password?: string;
    duressPassword?: string;
    decoyData?: DecryptedResult;
    authenticatedMeta?: string;
  }
): Promise<EncryptedPayload> {
  const encoder = new TextEncoder();
  const iterations = 600000;
  
  // Primary salt & IV
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);

  const primaryKey = await deriveAesKey(masterKey, options?.password, salt, iterations);
  
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
    adata: adataString,
  };

  // Coercion Resistance: Handle Duress / Decoy Payload
  if (options?.duressPassword && options.duressPassword.trim().length > 0 && options?.decoyData) {
    const decoySalt = new Uint8Array(16);
    crypto.getRandomValues(decoySalt);
    const decoyIv = new Uint8Array(12);
    crypto.getRandomValues(decoyIv);

    const decoyKey = await deriveAesKey(masterKey, options.duressPassword, decoySalt, iterations);
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
    };
  }

  return result;
}

/**
 * Decrypt Secret Payload using AES-256-GCM. Seamlessly handles Primary & Duress Decoy passwords.
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

  // 1. Try decrypting primary payload
  try {
    const saltBytes = payload.salt ? base64UrlToBytes(payload.salt) : new Uint8Array(16);
    const ivBytes = base64UrlToBytes(payload.iv);
    const ctBytes = base64UrlToBytes(payload.ct);

    const aesKey = await deriveAesKey(masterKey, password, saltBytes, iterations);

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

        const decoyKey = await deriveAesKey(masterKey, password, decoySaltBytes, iterations);

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
