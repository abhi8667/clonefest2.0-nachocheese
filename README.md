# CipherDrop

> Next-Generation Zero-Knowledge Sovereign Secret Exchange Platform

CipherDrop is a decentralized, zero-knowledge platform engineered for exchanging sensitive text, environment variables, credentials, private keys, and confidential file payloads across untrusted networks. Built as a ground-up modernization of the PrivateBin paradigm, CipherDrop replaces legacy 2010s PHP/jQuery architectures with a modern, high-throughput systems stack (React 18, TypeScript, Vite, Tailwind CSS, Node.js, WebSockets, and SQLite in Write-Ahead Logging mode).

CipherDrop introduces cryptographic innovations including Multi-Recipient Envelope Key Wrapping, Plausible Deniability via Duress Decoys, Inbound Asymmetric Secret DropBoxes, Real-Time Ephemeral Incident War Rooms, and LSB Steganographic Image Carriers.

---

## Technical Specifications

| Parameter | Specification | Standard / Reference |
| :--- | :--- | :--- |
| Symmetric Cipher | AES-256-GCM (256-bit key, 96-bit IV, 128-bit auth tag) | NIST SP 800-38D |
| Key Derivation | PBKDF2-HMAC-SHA256 (600,000 iterations, 128-bit salt) | OWASP Password Storage Guidelines |
| Asymmetric Exchange | RSA-OAEP 2048-bit with SHA-256 Digest | PKCS #1 v2.2 / RFC 8017 |
| Secret Key Encoding | Base58 (Bitcoin Alphabet, Non-Ambiguous) | BIP-0058 |
| Hash Fragment Transport | URI Fragment (`#p=<id>&k=<key>`) | RFC 3986 Section 3.5 |
| Storage Architecture | SQLite with WAL (Write-Ahead Logging) Mode | ACID-Compliant Embedded Storage |
| Real-Time Relay | Ephemeral WebSocket Blind Pub/Sub Relay | RFC 6455 |
| Client Cryptography | W3C Web Cryptography API (SubtleCrypto) | W3C Recommendation |

---

## Threat Model and Security Guarantees

CipherDrop operates under a Zero-Knowledge Trust Model:

### 1. Untrusted Server Assumption
The storage and relay server is assumed to be fully compromised, monitored by untrusted infrastructure operators, or subject to subpoena. The server:
- Never receives unencrypted payload data.
- Never receives master decryption keys, slot keys, or user passphrases.
- Cannot decrypt stored secrets, comments, war room messages, or file attachments.
- Receives key material solely inside the client-side URI fragment identifier (`#`), which standard HTTP clients do not transmit over the network.

### 2. Coercion and Compelled Disclosure Defense (Rubber-Hose Cryptanalysis)
When a user is coerced into revealing a password under duress:
- Providing the primary password decrypts the authentic payload.
- Providing the pre-configured duress password decrypts an innocent decoy payload.
- Decoy containers are indistinguishable from authentic containers, offering plausible deniability with zero mathematical proof of secondary data existence.

### 3. Slot-Swapping and Tampering Mitigations
In Multi-Recipient Envelope mode:
- Each wrapped Content Encryption Key (CEK) is authenticated with Additional Authenticated Data (AAD) strictly bound to `cipherdrop-envelope:<slotId>`.
- Any attempt by an intermediary to swap envelopes or alter slot identifiers fails authentication tag verification during AES-GCM decryption.

### 4. Ephemeral Memory Hygiene
Client-side memory buffers containing raw key material, decrypted strings, and binary file buffers are explicitly scrubbed and overwritten with pseudorandom bytes (`crypto.getRandomValues`) upon component unmount or view teardown.

### 5. Server-Assisted Time-Lock Release & Security Boundary
When Time-Lock Secrets are enabled:
- Secrets are encrypted client-side using random AES-256-GCM keys. The plaintext and master decryption key are never transmitted to the server.
- The server stores the blind ciphertext associated with an authoritative `unlock_at` timestamp (in UTC).
- Prior to `unlock_at`, the API strictly refuses retrieval requests and responds with `HTTP 423 Locked`, returning **zero ciphertext**. View counters are not decremented and burn-after-reading is not triggered.
- Client-side countdowns provide responsive UX, but server-side UTC time is the authoritative authorization boundary.
- *Limitation & Architecture Note*: This initial implementation provides server-assisted protocol gating rather than a trustless cryptographic time-lock against a compromised server. The release layer is isolated (`TimeLockPolicy`) to allow seamless future upgrade to distributed threshold release or verifiable time-lock puzzles.

---

## Core Protocol and Cryptographic Workflows

### 1. Multi-Recipient Envelope Encryption (Hybrid Key Wrapping)

When sharing a single confidential payload among $N$ distinct recipients:

```
[ Secret Payload ]
       |
       v (AES-256-GCM)
[ Encrypted Ciphertext ] <----------------------------------+
                                                            |
                     [ Content Encryption Key (CEK) ]       |
                                    |                       |
       +----------------------------+-----------------------+
       |                            |                       |
       v (Wrap with Slot Key 1)     v (Wrap with Slot Key 2)v (Wrap with Slot Key N)
 [ Envelope 1 (Alice) ]       [ Envelope 2 (Bob) ]    [ Envelope N (Custom) ]
       |                            |                       |
       v                            v                       v
 URL: #p=ID&slot=1&k=KEY1    URL: #p=ID&slot=2&k=KEY2 URL: #p=ID&slot=N&k=KEYN
```

1. **Payload Encryption**: The secret payload is serialized and encrypted exactly once using a cryptographically random 256-bit Content Encryption Key ($K_{CEK}$) via AES-256-GCM.
2. **Envelope Wrapping**: For each recipient $i \in \{1, \dots, N\}$, an isolated slot key $K_{slot, i}$ is generated. $K_{CEK}$ is encrypted with $K_{slot, i}$ (derived with PBKDF2 if an optional passphrase is set) using AES-256-GCM with AAD bound to `cipherdrop-envelope:<slotId_i>`.
3. **Zero-Knowledge Admin Telemetry**: An admin token $T_{admin}$ is generated client-side. The server stores only $H(T_{admin}) = \text{SHA-256}(T_{admin})$. The creator monitors read receipts and can selectively revoke individual recipient envelopes without invalidating access for remaining participants.

### 2. Inbound Asymmetric "Request-a-Secret" Exchange

For collecting credentials from external clients without requiring prior key exchange:

```
[ Requester Client ]                                [ Submitter Client ]
        |                                                   |
 1. Generate RSA-2048 Keypair                               |
 2. Store Private Key in sessionStorage                     |
 3. Send Public Key URL ----------------------------------> |
                                                    4. Enter secret credentials
                                                    5. Generate random AES-256 key
                                                    6. Encrypt secret with AES-256-GCM
                                                    7. Encrypt AES key with RSA Public Key
                                                    8. Submit hybrid payload to server
        | <-------------------------------------------------+
 9. Fetch encrypted payload from server
10. Decrypt AES key with RSA Private Key
11. Decrypt secret payload with AES key
```

---

## Architectural Comparison

| Dimension | Legacy PrivateBin | HashiCorp Vault | Bitwarden Send | CipherDrop |
| :--- | :--- | :--- | :--- | :--- |
| Primary Focus | Pastebin Text Sharing | Infrastructure Secrets | Password Management | Zero-Knowledge Secret Exchange |
| Frontend Architecture | jQuery / Bootstrap / PHP | React / Enterprise UI | Angular / TypeScript | React 18 / TypeScript / Vite |
| Key Derivation Rounds | 100,000 PBKDF2 | N/A (Server-Managed) | 100,000 - 600,000 | 600,000 PBKDF2-SHA256 |
| Multi-Recipient Envelopes | No | Access Policies (RBAC) | No | Yes (Isolated Keys + Telemetry) |
| Duress / Decoy Mode | No | No | No | Yes (Plausible Deniability) |
| Inbound Asymmetric Drops | No | No | No | Yes (RSA-OAEP 2048-bit) |
| Real-Time Incident Rooms | No | No | No | Yes (E2EE WebSockets) |
| Steganographic Disguise | No | No | No | Yes (LSB Pixel Carrier) |
| Structured Formats | Text / Basic Code | Key-Value / JSON | Text / File | Code (20+ langs), .ENV, MD, Files |
| Offline Cryptographic Tool | No | No | No | Yes (100% Offline Sandbox) |

---

## Comprehensive Feature Guide

### 1. Multi-Recipient Envelopes and Creator Telemetry
- Supports arbitrary $N$ recipients with custom slot labels.
- Independent burn-after-reading toggles per recipient slot.
- Optional slot-specific passphrases for two-factor link protection.
- Creator Admin Dashboard providing real-time read receipts (`Pending`, `Read`, `Burned`) and single-click individual slot revocation.

### 2. Coercion Resistance (Duress / Decoy Mode)
- Configures dual cryptographic key derivations from distinct password inputs.
- The primary password decrypts authentic confidential materials.
- The duress password decrypts an innocent decoy document without leaving traces of the primary container.

### 3. Inbound "Request-a-Secret" DropBox
- Generates ephemeral public-key drop links to securely collect API tokens, database connection strings, or private keys from non-technical stakeholders.
- Uses client-side RSA-OAEP 2048-bit asymmetric encryption to guarantee that only the generating browser instance can read the submission.

### 4. Real-Time E2EE Ephemeral Incident War Room
- Zero-knowledge collaborative response space for DevOps and SecOps teams handling live security incidents.
- End-to-end encrypted live markdown collaborative scratchpad.
- End-to-end encrypted live chat relayed over blind WebSocket pub/sub channels.
- Emergency Nuke trigger that broadcasts a cryptographic wipe signal and zeroes out server memory.

### 5. Steganographic Disguise Carrier
- Embeds encrypted AES-256-GCM payloads into the Least Significant Bits (LSB) of PNG carrier image pixel arrays.
- Transports confidential credentials past deep packet inspection (DPI) firewalls and content-filtering proxies as visually indistinguishable standard images.

### 6. Developer Workspaces and Structured Formats
- **Multi-Language Code Highlighting**: Syntax support for 20+ languages including Python, TypeScript, JavaScript, Rust, Go, SQL, Bash, YAML, JSON, and Dockerfile.
- **Interactive .ENV Key Constructor**: Structured key-value editor with individual value masking, format validation, and one-click export.
- **Live Markdown Split-View**: Real-time rendering with support for tables, blockquotes, code blocks, and checklists.
- **Encrypted Binary Attachments**: Chunked encryption for files up to 15MB with MIME-type preservation.

### 7. Ephemeral Lifecycles and Background Janitor
- Configurable expiration intervals: 1 view (Burn on Read), 5 minutes, 15 minutes, 1 hour, 1 day, 7 days, 30 days, or persistent.
- View counters with atomic decrement operations.
- Server-side background worker running every 30 seconds to purge expired and burned records from SQLite.

### 8. Air-Gapped Operation and Offline Sandbox
- High-density QR code generator enabling direct optical transfer to mobile devices and air-gapped workstations.
- Offline Cryptographic Sandbox allowing encryption, decryption, and hash verification with zero network dependencies.

### 9. Time-Lock Secrets (Scheduled Release)
- Restricts decryption access until a specified release date and time (stored in UTC).
- The client encrypts the secret normally via WebCrypto; the server enforces the time-lock gate before serving ciphertext.
- Pre-release requests return `HTTP 423 Locked` with zero ciphertext.
- Compatible with all core features: single-recipient links, multi-recipient envelopes, password protection, and burn-after-reading (burn is executed only upon post-unlock retrieval).
- Interactive client-side countdown and timezone preview.

---

## REST API and WebSocket Reference

### Secret Management Endpoints

#### Create Secret
```http
POST /api/paste
Content-Type: application/json

{
  "payload": {
    "v": 2,
    "ct": "<base64url_ciphertext>",
    "iv": "<base64url_iv>",
    "salt": "<base64url_salt>",
    "duress": { ... }
  },
  "isMultiRecipient": false,
  "envelopes": null,
  "adminTokenHash": null,
  "expireInSeconds": 86400,
  "burnAfterReading": false,
  "maxViews": -1,
  "openDiscussion": false,
  "timeLockEnabled": true,
  "unlockAt": "2026-09-01T12:00:00.000Z"
}
```

#### Fetch Secret / Slot
```http
GET /api/paste/:id
GET /api/paste/:id?slot=:slotId
```

**Response (When Time-Locked):**
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

**Response (When Unlocked):**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": "4a1f8b3c9d2e0f1a",
  "payload": { "v": 2, "ct": "...", "iv": "..." },
  "expireAt": 1788264000,
  "timeLockEnabled": true,
  "unlockAt": "2026-09-01T12:00:00.000Z"
}
```

#### Creator Admin Telemetry
```http
GET /api/paste/:id/admin?tokenHash=:tokenHash
```

#### Revoke Recipient Slot
```http
DELETE /api/paste/:id/slot/:slotId
Content-Type: application/json

{
  "tokenHash": "<sha256_admin_token_hash>"
}
```

#### Inbound Drop Endpoints
```http
POST /api/request-drop
GET  /api/request-drop/:id
POST /api/request-drop/:id/submit
```

#### Incident War Room WebSocket
```
ws://<host>/ws/incident-room?room=<room_id>
```

---

## Developer SDK Integration Examples

### cURL
```bash
# Fetch blind ciphertext payload
curl -s https://cipherdrop.internal/api/paste/4a1f8b3c9d2e0f1a | jq .
```

### Python
```python
import base64
import requests

# Retrieve encrypted payload from CipherDrop API
response = requests.get("https://cipherdrop.internal/api/paste/4a1f8b3c9d2e0f1a")
payload = response.json()["payload"]

print(f"Ciphertext received: {payload['ct'][:32]}...")
# Decryption performed client-side using cryptography or PyCryptodome (AES-256-GCM)
```

### TypeScript / Node.js
```typescript
import { decryptSecret } from './src/crypto/webcrypto';

async function fetchAndDecrypt(pasteId: string, masterKey: string) {
  const res = await fetch(`https://cipherdrop.internal/api/paste/${pasteId}`);
  const data = await res.json();
  const decrypted = await decryptSecret(data.payload, masterKey);
  console.log('Decrypted content:', decrypted.text);
}
```

---

## Automated Verification and Test Suite

The CipherDrop test suite validates cryptographic invariants, edge cases, and end-to-end workflows.

### Running Cryptographic Unit Tests
```bash
npm test
```
Validates:
- Base64URL and Base58 bidirectional encoding integrity.
- CSPRNG master key entropy and distribution.
- AES-256-GCM zero-knowledge encryption and decryption without passphrases.
- PBKDF2-HMAC-SHA256 (600,000 iterations) password derivation and authentication rejection.
- Duress / decoy plausible deniability execution.
- RSA-OAEP 2048-bit asymmetric key generation and exchange.
- Multi-recipient key envelope wrapping and unwrapping across $N$ recipients.
- Memory zeroization hygiene.

### Running Full End-to-End Integration Tests
```bash
node --test tests/e2e_integration.test.js
```
Validates:
- Secret creation, blind retrieval, and client-side decryption.
- Duress password switching under live server conditions.
- Atomic burn-on-read destruction and eviction.
- Threaded end-to-end encrypted comments.
- Asymmetric inbound drop submission and retrieval.
- WebSocket blind relay for real-time war rooms.
- Multi-recipient slot burning, creator admin telemetry, and selective slot revocation.

---

## Local Development and Deployment

### Prerequisites
- Node.js v18.0.0 or higher
- npm v9.0.0 or higher

### Local Installation
```bash
# Clone the repository
git clone https://github.com/<your-username>/CipherDrop.git
cd CipherDrop

# Install dependencies
npm install

# Start development servers (Frontend on :5173, Backend on :3001)
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

This project is licensed under the **MIT License**.
