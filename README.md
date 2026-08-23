# CipherDrop 🔐
> **Next-Generation Zero-Knowledge Sovereign Secret Exchange Platform**

CipherDrop is a modern, decentralized, zero-knowledge platform for sharing sensitive text, environment variables, credentials, private keys, and confidential files online. Built as an independent reimagining of PrivateBin, CipherDrop replaces legacy 2010s stacks with a high-performance, modern full-stack architecture (**React 18, TypeScript, Vite, Tailwind CSS, Node.js, WebSockets, SQLite WAL**) and brings breakthrough innovations like **Duress/Decoy Plausible Deniability**, **Inbound "Request-a-Secret" DropBoxes**, **Real-Time E2EE Ephemeral Incident War Rooms**, and **Steganography Disguise Carriers**.

---

##  Key Features & Innovations

### 1.  Coercion Resistance (Duress / Decoy Mode)
* Set a secondary **Duress Password** alongside your real password.
* If forced to disclose your password under duress or coercion, entering the duress password seamlessly derives the secondary key and decrypts an innocent **Decoy Secret** with zero mathematical proof that a primary secret exists.

### 2.  Inbound "Request-a-Secret" DropBox
* Need credentials from a non-technical client, vendor, or colleague? Generate a single-use inbound secret drop link.
* Uses browser-generated **RSA-OAEP 2048-bit + AES-GCM hybrid asymmetric encryption**.
* The submitter enters the credentials in their browser; their browser encrypts it with your public key before sending. Only your browser session with the private key can decrypt the submission!

### 3.  Real-Time E2EE Ephemeral Incident War Room
* Instant collaborative workspace for DevOps, SysAdmins, and SecOps responders handling live outages or credential rotation.
* Features a live synchronized encrypted collaborative scratchpad and real-time incident chat over WebSockets.
* Includes an **Emergency Nuke & Zeroize** button that immediately purges the room state across all connected peers.

### 4.  Steganography Disguise Carrier (DPI Bypass)
* Injects encrypted AES-256-GCM payloads into the Least Significant Bits (LSB) of PNG carrier image pixels.
* Recipient can drag-and-drop the clean carrier image into CipherDrop and decrypt the hidden payload with their key.

### 5.  Multi-Format Smart Secret Editors
* **Multi-Language Code Editor**: Syntax highlighting with line numbers for 20+ languages (Python, JS, TS, Rust, Go, SQL, Bash, YAML, JSON, Dockerfile, etc.).
* **Live Markdown Split View**: Real-time side-by-side formatted preview with tables and checklists.
* **Structured `.ENV` Builder**: Specialized key-value credentials constructor with individual value masking and one-click copy buttons.
* **Encrypted File Attachments**: Drag-and-drop any binary file (PDFs, images, documents, zips up to 15MB) with client-side chunk encryption.

### 6.  Ephemeral Lifecycles & Guaranteed Destruction
* **Granular Expirations**: Burn after 1 view, 5m, 15m, 1h, 1d, 7d, 30d, or persistent.
* **Custom View Limits**: Restrict secrets to exactly 1, 2, 5, or 10 views before automatic destruction.
* **Automated Background Janitor**: Server-side background worker automatically sweeps and purges expired secrets every 30 seconds.
* **Encrypted Discussions**: Threaded replies where every comment is encrypted symmetrically before submission.

### 7.  Air-Gapped & Developer Tools
* **Air-Gapped QR Code Handoff**: Scan encrypted secret URLs directly from phone cameras.
* **Offline Cryptographic Sandbox**: Encrypt and decrypt text and files 100% offline without sending any network requests.
* **Interactive API & CLI Hub**: Live code generators with copy-paste snippets in **cURL**, **JavaScript**, **Python**, **Go**, and **Rust**.

---

##  Cryptographic Architecture

* **Symmetric Cipher**: AES-256-GCM (Galois/Counter Mode) with 128-bit authentication tag.
* **Key Derivation**: PBKDF2-SHA256 with **600,000 iterations** (OWASP standard) + 128-bit random salt.
* **Asymmetric Exchange**: RSA-OAEP 2048-bit with SHA-256 for inbound secret drops.
* **Master Key Encoding**: Base58 (Bitcoin alphabet) preventing ambiguous characters (`0`, `O`, `I`, `l`).
* **URL Hash Routing**: Decryption keys reside exclusively in the `#` fragment (`#p=<id>&k=<key>`), which RFC 3986 guarantees is never sent to the server in HTTP requests.
* **Memory Hygiene**: Memory buffers holding key material are explicitly zeroized with PRNG random bytes upon unmount.

---

##  Getting Started

### Prerequisites
* **Node.js** v18+ (tested on Node v22 / v24)
* **npm** v9+

### Installation
```bash
# Clone the repository
git clone https://github.com/<your-username>/<your-repo-name>.git
cd <your-repo-name>

# Install dependencies
npm install
```

### Development
To run both the backend (Express + WebSockets) and frontend (Vite) concurrently:
```bash
npm run dev
```
* **Frontend**: `http://localhost:5173`
* **Backend API & WebSockets Relay**: `http://localhost:3001`

### Running Automated Tests
```bash
# Run unit tests
npm test

# Run full end-to-end integration test suite
node --test tests/e2e_integration.test.js
```

### Production Build
```bash
# Compile TypeScript & bundle production assets
npm run build

# Start production server
npm start
```

---

##  Comparison Matrix

| Capability | Legacy PrivateBin | CipherDrop |
| :--- | :--- | :--- |
| **Technology Stack** | PHP 7/8, jQuery, Bootstrap | **React 18, TypeScript, Vite, Tailwind CSS, Node.js, WebSockets, SQLite WAL** |
| **Cryptography Core** | SJCL / early WebCrypto, 100k rounds | **WebCrypto AES-256-GCM, 600,000 PBKDF2 iterations** |
| **Coercion Resistance** |  None | **Duress / Decoy Password Plausible Deniability** |
| **Inbound Secret Intake** |  None | **Asymmetric RSA-OAEP "Request-a-Secret" DropBox** |
| **Real-Time Collaboration**|  None | **Live E2EE Ephemeral Incident War Room with Emergency Nuke** |
| **DPI Bypass Disguise** |  None | **Steganography PNG Carrier (LSB Pixel Injection)** |
| **Secret Formats** | Plaintext, Basic Code | **20+ Language Highlighting, Live Markdown, Structured .ENV, File Attachments** |
| **Air-Gapped / Offline** | Partial | **QR Code Handoff + 100% Offline Local Crypto Sandbox** |
| **Developer Hub** | Basic API | **Interactive Hub with cURL, JS, Python, Go, Rust code generators** |

---

##  License
This project is open-source under the **MIT License**.
