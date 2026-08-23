# CipherDrop

> **Next-Generation Zero-Knowledge Sovereign Secret Exchange Platform**

CipherDrop is a decentralized, zero-knowledge platform engineered for exchanging sensitive text, environment variables, credentials, private keys, and confidential file payloads across untrusted networks. Built as a ground-up modernization of the PrivateBin paradigm, CipherDrop replaces legacy 2010s PHP/jQuery architectures with a modern, high-throughput systems stack (React 18, TypeScript, Vite, Tailwind CSS, Node.js, WebSockets, and SQLite in Write-Ahead Logging mode).

CipherDrop introduces state-of-the-art cryptographic innovations including **Multi-Recipient Envelope Key Wrapping**, **Plausible Deniability via Duress Decoys**, **Inbound Asymmetric Secret DropBoxes**, **Real-Time Ephemeral Incident War Rooms**, **LSB Steganographic Image Carriers**, **Server-Assisted Time-Lock Scheduled Releases**, and a **100% Air-Gapped Offline Sandbox**.

---

## Technical Specifications

| Parameter | Specification | Standard / Reference |
| :--- | :--- | :--- |
| **Symmetric Cipher** | AES-256-GCM (256-bit key, 96-bit IV, 128-bit authentication tag) | NIST SP 800-38D |
| **Key Derivation Function** | PBKDF2-HMAC-SHA256 (600,000 iterations, 128-bit CSPRNG salt) | OWASP Password Storage Guidelines |
| **Asymmetric Exchange** | RSA-OAEP 2048-bit with SHA-256 Digest | PKCS #1 v2.2 / RFC 8017 |
| **Secret Key Encoding** | Base58 (Bitcoin Alphabet, Non-Ambiguous: no `0`, `O`, `I`, `l`) | BIP-0058 |
| **Ciphertext & Nonce Encoding** | Base64URL (URL-safe alphabet without padding) | RFC 4648 Section 5 |
| **Hash Fragment Transport** | URI Fragment Identifier (`#p=<id>&k=<key>`) | RFC 3986 Section 3.5 |
| **Database Architecture** | SQLite with WAL (Write-Ahead Logging) Mode | ACID-Compliant Embedded Storage |
| **Real-Time Transport** | Ephemeral WebSocket Blind Pub/Sub Relay | RFC 6455 |
| **Client Cryptography** | W3C Web Cryptography API (`window.crypto.subtle`) | W3C Recommendation |
| **Memory Hygiene** | Client-side CSPRNG buffer zeroization (`crypto.getRandomValues`) | Defensive Systems Engineering |

---

## Threat Model and Security Guarantees

CipherDrop operates under a strict **Zero-Knowledge Trust Model**:

### 1. Untrusted Server Assumption
The storage and relay server is assumed to be fully untrusted, monitored by adversarial infrastructure operators, or subject to legal seizure. Under this model:
- The server never receives unencrypted payload data.
- The server never receives master decryption keys, slot keys, or user passphrases.
- The server cannot decrypt stored secrets, comments, war room messages, or file attachments.
- Key material exists solely inside the client-side URI fragment identifier (`#`), which standard HTTP user agents strictly refuse to transmit over the network wire.

### 2. Coercion and Compelled Disclosure Defense (Rubber-Hose Cryptanalysis)
When a user is coerced into revealing a password under physical threat or compelled disclosure:
- Submitting the authentic password decrypts the genuine confidential payload.
- Submitting the pre-configured **duress password** decrypts an authentic-looking, innocent decoy document.
- Decoy containers are packaged directly within the encrypted payload with zero cryptographic or structural leakage, offering mathematical plausible deniability.

### 3. Slot-Swapping and Tampering Mitigations
In Multi-Recipient Envelope mode:
- Each wrapped Content Encryption Key (CEK) is authenticated with Additional Authenticated Data (AAD) strictly bound to `cipherdrop-envelope:<slotId>`.
- Any attempt by an intermediary or malicious server to swap envelopes, alter slot identifiers, or tamper with ciphertext causes AES-GCM authentication tag verification to fail immediately on the client.

### 4. Ephemeral In-Memory Zeroization
Client-side memory buffers containing raw key material, decrypted strings, and binary file buffers are explicitly scrubbed and overwritten with pseudorandom bytes via `crypto.getRandomValues()` upon component unmount, view teardown, or secret destruction.

### 5. Server-Assisted Time-Lock Release & Security Boundary
When Time-Lock Secrets are enabled:
- Secrets are encrypted client-side using random AES-256-GCM keys. The plaintext and master decryption key are never transmitted to the server.
- The server stores the blind ciphertext associated with an authoritative `unlock_at` timestamp (in UTC).
- Prior to `unlock_at`, the API strictly refuses retrieval requests and responds with `HTTP 423 Locked`, returning **zero ciphertext**. View counters are not decremented and burn-after-reading is not triggered.
- Client-side countdowns provide responsive UX with local/UTC timezone previews, while server-side UTC time serves as the authoritative authorization gate.

### 6. Automated Background Storage Janitor
A server-side worker daemon runs every 30 seconds to permanently purge expired, burned, or revoked records and attachments from SQLite storage.

---

## Core Protocol and Cryptographic Workflows

### 1. Multi-Recipient Envelope Encryption (Hybrid Key Wrapping)

When sharing a single confidential payload among $N$ distinct recipients:

```
[ Secret Payload (Plaintext / ENV / Code / File) ]
                        |
                        v (AES-256-GCM with Random CEK)
[ Encrypted Master Ciphertext ] <----------------------------------+
                                                                   |
                             [ Content Encryption Key (CEK) ]      |
                                            |                      |
                +---------------------------+----------------------+
                |                           |                      |
                v (Wrap with Slot Key 1)    v (Wrap with Slot Key 2)v (Wrap with Slot Key N)
      [ Envelope 1 (Alice) ]      [ Envelope 2 (Bob) ]   [ Envelope N (Custom) ]
                |                           |                      |
                v                           v                      v
      URL: #p=ID&slot=1&k=KEY1    URL: #p=ID&slot=2&k=KEY2 URL: #p=ID&slot=N&k=KEYN
```

1. **Payload Encryption**: The secret payload is serialized and encrypted exactly once using a cryptographically random 256-bit Content Encryption Key ($K_{CEK}$) via AES-256-GCM.
2. **Envelope Wrapping**: For each recipient $i \in \{1, \dots, N\}$, an isolated slot key $K_{slot, i}$ is generated. $K_{CEK}$ is encrypted with $K_{slot, i}$ (derived with PBKDF2 if an optional passphrase is set) using AES-256-GCM with AAD bound to `cipherdrop-envelope:<slotId_i>`.
3. **Zero-Knowledge Admin Telemetry**: An admin token $T_{admin}$ is generated client-side. The server stores only $H(T_{admin}) = \text{SHA-256}(T_{admin})$. The creator monitors read receipts (`Pending`, `Read`, `Burned`) and can selectively revoke individual recipient envelopes without invalidating access for remaining participants.

---

### 2. Inbound Asymmetric "Request-a-Secret" Exchange

For collecting credentials from external clients without requiring prior key exchange:

```
[ Requester Client (Browser) ]                       [ Submitter Client (Browser) ]
              |                                                   |
 1. Generate RSA-OAEP 2048 Keypair                                |
 2. Store Private Key in Client Memory                            |
 3. Register Public Key -> Send URL ----------------------------> |
                                                          4. Enter secret credentials
                                                          5. Generate random AES-256 key
                                                          6. Encrypt secret with AES-256-GCM
                                                          7. Encrypt AES key with RSA Public Key
                                                          8. Submit hybrid payload to server
              | <-------------------------------------------------+
 9. Live polling detects completed drop
10. Decrypt AES key with RSA Private Key
11. Decrypt secret payload with AES key
```

---

### 3. Steganographic Disguise Carrier (LSB Pixel Carrier)

```
[ Secret Text / Credentials ] ---> [ AES-256-GCM Encryption ] ---> [ Encrypted Binary Payload ]
                                                                             |
                                                                             v
[ Carrier Image (PNG or Canvas) ] --------------------------------> [ LSB Pixel Injection ]
                                                                             |
                                                                             v
[ Indistinguishable Stego PNG Image ] ---> Transmit via Email / Slack / Public Storage
                                                                             |
                                                                             v
[ Recipient Browser ] -----------> [ Extract LSB Bits ] ----------> [ Decrypt with Master Key ]
```

---

## Architectural Comparison

| Feature / Dimension | Legacy PrivateBin | HashiCorp Vault | Bitwarden Send | CipherDrop |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Focus** | Pastebin Text Sharing | Infrastructure Secrets | Password Sharing | Sovereign Zero-Knowledge Secret Exchange |
| **Frontend Architecture** | jQuery / Bootstrap 3 / PHP | React / Enterprise UI | Angular / TypeScript | **React 18 / TypeScript / Vite / Tailwind** |
| **Key Derivation Standard** | 100,000 PBKDF2 | N/A (Server-Managed) | 100,000 - 600,000 | **600,000 PBKDF2-HMAC-SHA256 (OWASP)** |
| **Multi-Recipient Envelopes** | No | Access Policies (RBAC) | No | **Yes (Isolated Slot Keys + Live Telemetry)** |
| **Coercion / Duress Mode** | No | No | No | **Yes (Plausible Deniability Decoys)** |
| **Inbound Asymmetric Drops** | No | No | No | **Yes (Client-Side RSA-OAEP 2048)** |
| **Real-Time Incident Rooms** | No | No | No | **Yes (E2EE WebSocket Blind Pub/Sub)** |
| **Steganographic Disguise** | No | No | No | **Yes (LSB PNG Carrier Embed & Extract)** |
| **Time-Lock Scheduled Release**| No | No | No | **Yes (Authoritative UTC Protocol Gate)** |
| **Air-Gapped Offline Sandbox** | No | No | No | **Yes (100% Offline Browser Vault)** |
| **Structured Developer Formats**| Text / Code | Key-Value / JSON | Text / File | **Code (20+ langs), .ENV, MD, 15MB Files** |
| **Admin Read Receipts & Revoke**| No | Audit Logs | View Counts | **Yes (Zero-Knowledge Slot Telemetry)** |

---

## Comprehensive Feature Guide

### 1. Multi-Recipient Envelopes & Creator Telemetry
- **Independent Recipient Slots**: Create a secret once and generate unique decryption links for arbitrary $N$ recipients with custom names/labels (e.g., Alice, Bob, SRE Team).
- **Per-Slot Burn-on-Read**: Enable burn-after-reading for specific recipients while allowing persistent access for others.
- **Slot Passphrase Protection**: Set optional secondary passphrases for individual recipient links for two-factor security.
- **Creator Admin Dashboard**: Monitor real-time status (`Pending`, `Read`, `Burned`) with exact read timestamps.
- **Selective Slot Revocation**: Revoke any individual recipient's access with a single click without affecting other recipients.
- **One-Click Batch Distribution**: Copy all recipient links formatted as a clean list ready for Slack, Teams, or email.

### 2. Coercion Resistance (Duress / Decoy Mode)
- **Rubber-Hose Cryptanalysis Protection**: Configure dual cryptographic key derivations from separate passwords.
- **Authentic vs. Decoy Output**: Entering the primary password decrypts authentic confidential material; entering the duress password decrypts an innocent decoy document.
- **Plausible Deniability**: Decoy ciphertexts are seamlessly bundled with zero mathematical or structural leakage of the primary secret.

### 3. Inbound Asymmetric "Request-a-Secret" DropBox
- **Zero Pre-Shared Key Credential Intake**: Securely solicit API tokens, connection strings, or private keys from non-technical stakeholders or external clients.
- **Client-Side Keypair Generation**: Generates an RSA-OAEP 2048-bit keypair in the browser. The private key remains in client memory; the public key is registered on the server.
- **Live In-Memory Decryption**: The requester dashboard automatically polls for completion and decrypts incoming submissions in real-time.

### 4. Real-Time E2EE Ephemeral Incident War Room
- **Zero-Knowledge Incident Collaboration**: A dedicated response space for DevOps and SecOps teams handling live security incidents and outages.
- **Collaborative Encrypted Scratchpad**: End-to-end encrypted live Markdown scratchpad for incident runbooks and credentials rotation.
- **Encrypted Real-Time Chat**: End-to-end encrypted chat with customizable peer callsigns and timestamps relayed over a blind WebSocket pub/sub channel.
- **Peer Presence Tracking**: Real-time connected participant counter.
- **Emergency Nuke Trigger**: One-click broadcast of a cryptographic wipe signal that instantly erases the pad, clears chat history, and purges browser memory across all connected peers.

### 5. Steganographic Disguise Carrier (LSB Image Steganography)
- **Least Significant Bit Injection**: Embeds encrypted AES-256-GCM secret payloads directly into the pixel data of PNG carrier images.
- **Procedural Carrier Generator**: Generate high-entropy procedural canvas image carriers on the fly, or upload custom PNG images.
- **DPI & Firewall Evasion**: Transports credentials past Deep Packet Inspection (DPI) firewalls, web proxies, and content filters disguised as innocent images.
- **Client-Side Extractor**: Extract and decrypt embedded payloads entirely in browser memory.

### 6. Air-Gapped Operation & Offline Sandbox (Local Vault)
- **100% Offline Execution**: Perform AES-256-GCM encryption, decryption, and key generation completely offline with zero network requests.
- **High-Density QR Code Generator**: Generate high-density QR codes for optical air-gapped data transfer to mobile devices and isolated workstations.
- **Direct Payload Import/Export**: Paste and parse raw JSON ciphertext structures for offline inspection and verification.

### 7. Server-Assisted Time-Lock Secrets (Scheduled Release)
- **Scheduled Secret Unlocking**: Restrict decryption access until a specified future UTC release date and time.
- **Authoritative Server Gating**: Pre-release requests return `HTTP 423 Locked` with zero ciphertext. View limits and burn-after-reading triggers remain dormant until after release.
- **Interactive UI Preview**: Responsive live countdown timer with instant switching between UTC and local timezones.
- **Universal Compatibility**: Works seamlessly with single-recipient secrets, multi-recipient envelopes, passphrases, and file attachments.

### 8. Developer Workspaces & Structured Formats
- **Multi-Language Syntax Highlighting**: Native syntax highlighting for 20+ languages including JavaScript, TypeScript, Python, Rust, Go, SQL, Bash, JSON, YAML, Dockerfile, HTML/CSS, C/C++, and Java.
- **Interactive .ENV Key Constructor**: Structured key-value editor with individual value masking/unmasking, syntax validation, and one-click formatted export.
- **Live Markdown Split-View Preview**: Real-time rendering of Markdown formatting, code fences, blockquotes, tables, and task lists.
- **Encrypted Binary File Attachments**: Chunked client-side encryption for file attachments up to 15MB with MIME-type preservation and secure in-memory download.

### 9. Ephemeral Lifecycles, Expiration & Janitor
- **Flexible Expiration Profiles**: Configure lifetimes from Burn on Read (1 view), 5 minutes, 15 minutes, 1 hour, 1 day, 7 days, 30 days, to Persistent (Never Expire).
- **Atomic View Limits**: Optional maximum view count enforcement (`maxViews`) with atomic server-side decrement operations.
- **Creator Deletion Token**: Creators receive a unique deletion token to permanently destroy secrets before their scheduled expiration.
- **Automated Janitor Worker**: Server-side cleanup worker executing every 30 seconds to purge expired and burned records from SQLite.

### 10. Threaded E2EE Discussion Comments
- **Encrypted Reply Threads**: Optional end-to-end encrypted threaded comments attached to stored secrets.
- **Zero Server Visibility**: Each comment is encrypted client-side using the master Content Encryption Key before transmission.

### 11. Developer API & CLI Hub
- **Interactive API Documentation**: Embedded documentation hub with ready-to-use code integration examples for cURL, JavaScript/TypeScript, Python, and Go.
- **Standardized Error Schemas**: Clear HTTP status codes and structured JSON error responses.

### 12. Modern Obsidian / Cyberpunk UX
- **Refined Aesthetics**: Dark obsidian aesthetic with glowing emerald accents, glassmorphic panels, and fluid micro-animations.
- **Productivity Shortcuts**: Press `Cmd + Enter` or `Ctrl + Enter` to publish secrets immediately.
- **Celebration Confetti**: Dynamic visual feedback upon secret creation.
- **Responsive Mobile Interface**: Full feature parity across desktop, tablet, and mobile with horizontally scrollable navigation.

---

## REST API and WebSocket Reference

### Secret Management Endpoints

#### 1. Create Secret
```http
POST /api/paste
Content-Type: application/json

{
  "payload": {
    "v": 2,
    "ct": "<base64url_ciphertext>",
    "iv": "<base64url_iv>",
    "salt": "<base64url_salt>",
    "duress": {
      "enabled": true,
      "decoyCt": "<base64url_decoy_ciphertext>",
      "decoyIv": "<base64url_decoy_iv>",
      "decoySalt": "<base64url_decoy_salt>"
    }
  },
  "isMultiRecipient": false,
  "envelopes": null,
  "adminTokenHash": "<sha256_admin_token_hash>",
  "expireInSeconds": 86400,
  "burnAfterReading": false,
  "maxViews": -1,
  "openDiscussion": false,
  "timeLockEnabled": true,
  "unlockAt": "2026-09-01T12:00:00.000Z"
}
```

#### 2. Fetch Secret or Recipient Slot
```http
GET /api/paste/:id
GET /api/paste/:id?slot=:slotId
```

**Response (When Time-Locked - HTTP 423):**
```http
HTTP/1.1 423 Locked
Content-Type: application/json

{
  "error": "TIME_LOCKED",
  "message": "This secret is time-locked and cannot be decrypted yet.",
  "unlockAt": "2026-09-01T12:00:00.000Z",
  "timeLockEnabled": true
}
```

**Response (When Unlocked - HTTP 200):**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": "4a1f8b3c9d2e0f1a",
  "payload": {
    "v": 2,
    "ct": "x8K2...ciphertext...",
    "iv": "m4Z...iv..."
  },
  "expireAt": 1788264000,
  "burnAfterReading": false,
  "comments": [],
  "timeLockEnabled": true,
  "unlockAt": "2026-09-01T12:00:00.000Z"
}
```

#### 3. Creator Admin Telemetry
```http
GET /api/paste/:id/admin?tokenHash=:tokenHash
```

#### 4. Revoke Recipient Slot
```http
DELETE /api/paste/:id/slot/:slotId
Content-Type: application/json

{
  "tokenHash": "<sha256_admin_token_hash>"
}
```

#### 5. Early Deletion with Token
```http
DELETE /api/paste/:id
Content-Type: application/json

{
  "token": "<deletion_token>"
}
```

#### 6. Add Threaded Comment
```http
POST /api/paste/:id/comment
Content-Type: application/json

{
  "encryptedPayload": {
    "v": 2,
    "ct": "<base64url_comment_ciphertext>",
    "iv": "<base64url_comment_iv>"
  }
}
```

---

### Inbound Drop Endpoints

#### 1. Register Inbound Drop
```http
POST /api/request-drop
Content-Type: application/json

{
  "prompt": "Please supply production database credentials.",
  "publicKey": "<rsa_public_key_string>"
}
```

#### 2. Get Drop Details
```http
GET /api/request-drop/:id
```

#### 3. Submit Inbound Secret
```http
POST /api/request-drop/:id/submit
Content-Type: application/json

{
  "encryptedPayload": {
    "ct": "<base64url_ciphertext>",
    "iv": "<base64url_iv>",
    "encKey": "<rsa_encrypted_aes_key>"
  }
}
```

---

### Real-Time Incident War Room WebSocket
```
ws://<host>/ws/incident-room?room=<room_id>
```

**Message Types:**
- `presence`: `{ "type": "presence", "count": 4 }`
- `pad-update`: `{ "type": "pad-update", "payload": { "ct": "...", "iv": "..." } }`
- `chat`: `{ "type": "chat", "payload": { "ct": "...", "iv": "..." } }`
- `room-nuked`: `{ "type": "room-nuked" }`

---

## Developer SDK & Integration Examples

### cURL
```bash
# 1. Post pre-encrypted AES-256-GCM ciphertext
curl -X POST https://cipherdrop.internal/api/paste \
  -H "Content-Type: application/json" \
  -d '{
    "payload": {
      "v": 2,
      "ct": "x8K2...base64url_ciphertext...",
      "iv": "m4Z...base64url_iv..."
    },
    "expireInSeconds": 86400,
    "burnAfterReading": false,
    "timeLockEnabled": true,
    "unlockAt": "2026-09-01T12:00:00.000Z"
  }'

# 2. Retrieve ciphertext (Returns HTTP 423 Locked before unlockAt, HTTP 200 after)
curl -i https://cipherdrop.internal/api/paste/4a1f8b3c9d2e0f1a
```

### TypeScript / Node.js
```typescript
import { decryptSecret } from './src/crypto/webcrypto';

async function fetchAndDecrypt(pasteId: string, masterKey: string) {
  const res = await fetch(`https://cipherdrop.internal/api/paste/${pasteId}`);
  if (res.status === 423) {
    console.log('Secret is time-locked.');
    return;
  }
  const data = await res.json();
  const decrypted = await decryptSecret(data.payload, masterKey);
  console.log('Decrypted content:', decrypted.text);
}
```

### Python
```python
import os, requests, base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# Client-Side Zero-Knowledge Encryption in Python
def create_secret(text: str):
    key = AESGCM.generate_key(bit_length=256)
    nonce = os.urandom(12)
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(nonce, text.encode('utf-8'), b"cipherdrop-v2")
    
    res = requests.post("https://cipherdrop.internal/api/paste", json={
        "payload": {
            "v": 2,
            "ct": base64.urlsafe_b64encode(ciphertext).decode().rstrip('='),
            "iv": base64.urlsafe_b64encode(nonce).decode().rstrip('='),
            "adata": "cipherdrop-v2"
        },
        "expireInSeconds": 86400,
        "burnAfterReading": True
    })
    paste_id = res.json()["id"]
    print(f"Decryption Link: https://cipherdrop.internal/#p={paste_id}&k={key.hex()}")
```

### Go
```go
package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"io"
)

func EncryptSecret(secret []byte) (key []byte, iv []byte, ct []byte, err error) {
	key = make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		return nil, nil, nil, err
	}
	
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, nil, nil, err
	}
	
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, nil, err
	}
	
	iv = make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return nil, nil, nil, err
	}
	
	ct = gcm.Seal(nil, iv, secret, []byte("cipherdrop-v2"))
	return key, iv, ct, nil
}
```

---

## Automated Verification and Test Suite

The CipherDrop automated test suite validates cryptographic invariants, edge cases, and end-to-end workflows.

### Running Cryptographic & Integration Tests
```bash
npm test
```

### Test Coverage Highlights:
- **Encoding & Nonces**: Base64URL and Base58 bidirectional encoding integrity.
- **CSPRNG Entropy**: Master key entropy distribution and random generation.
- **AES-256-GCM**: Zero-knowledge encryption and decryption without passphrases.
- **PBKDF2-HMAC-SHA256**: 600,000-iteration key derivation and authentication rejection.
- **Duress / Decoy Mode**: Plausible deniability execution under live server conditions.
- **Asymmetric Drop**: RSA-OAEP 2048-bit key generation and hybrid envelope exchange.
- **Multi-Recipient Envelopes**: Envelope wrapping across $N$ recipients, per-slot reads, per-slot burning, and selective slot revocation.
- **Memory Zeroization**: Verification of in-memory key scrubbing.
- **Time-Lock Protocol Gating**: Validates `HTTP 423 Locked` pre-release protection, zero ciphertext disclosure, view count preservation, post-unlock decryption, and server clock authority.
- **WebSocket War Room**: Live E2EE relay and emergency nuke broadcasts.

---

## Local Development and Deployment

### Prerequisites
- Node.js v18.0.0 or higher
- npm v9.0.0 or higher

### Local Installation
```bash
# Clone repository
git clone https://github.com/<your-username>/CipherDrop.git
cd CipherDrop

# Install dependencies
npm install

# Start development servers (Vite Frontend on :5173, Backend on :3001)
npm run dev
```

### Production Build
```bash
# Compile TypeScript and generate optimized Vite bundle
npm run build

# Start production server
NODE_ENV=production npm start
```

### Docker Deployment
```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
EXPOSE 3001
CMD ["node", "server/index.js"]
```

---

## License

This project is licensed under the **MIT License**. See [LICENSE.md](file:///Users/daivikmankame/clonefest2.0-nachocheese/LICENSE.md) for full license text.
