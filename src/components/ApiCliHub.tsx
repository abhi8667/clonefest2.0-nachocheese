import React, { useState } from 'react';
import { 
  Terminal, 
  Code2, 
  Copy, 
  Check, 
  BookOpen, 
  ShieldCheck, 
  Globe, 
  Layers
} from 'lucide-react';

const SNIPPETS = {
  curl: `# 1. Post pre-encrypted AES-256-GCM ciphertext to CipherDrop API
curl -X POST https://your-cipherdrop.com/api/paste \\
  -H "Content-Type: application/json" \\
  -d '{
    "payload": {
      "v": 2,
      "ct": "x8K2...base64url_ciphertext...",
      "iv": "m4Z...base64url_iv...",
      "adata": "cipherdrop-v2:code:1"
    },
    "expireInSeconds": 86400,
    "burnAfterReading": true,
    "openDiscussion": false
  }'

# 2. Retrieve blind ciphertext
curl https://your-cipherdrop.com/api/paste/3a8f9c1b7e4d021f`,

  javascript: `// Sovereign Zero-Knowledge Client-Side Encryption in JS / Node
import crypto from 'crypto';

async function createCipherDropSecret(plainText) {
  // 1. Generate 256-bit AES master key
  const masterKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  
  // 2. Encrypt with AES-256-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
  const ct = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // 3. Post blind ciphertext to API
  const res = await fetch('http://localhost:3001/api/paste', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: {
        v: 2,
        ct: Buffer.concat([ct, authTag]).toString('base64url'),
        iv: iv.toString('base64url')
      },
      expireInSeconds: 86400,
      burnAfterReading: true
    })
  });
  
  const { id } = await res.json();
  console.log(\`Zero-Knowledge URL: https://example.com/#p=\${id}&k=\${masterKey.toString('hex')}\`);
}`,

  python: `# Client-Side Zero-Knowledge Encryption in Python
import os, json, base64, requests
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

def push_secret(secret_text: str):
    # 1. Generate 256-bit random key and 96-bit nonce
    key = AESGCM.generate_key(bit_length=256)
    nonce = os.urandom(12)
    
    # 2. Encrypt in-memory
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(nonce, secret_text.encode(), b"cipherdrop-v2")
    
    # 3. Post blind ciphertext to server
    res = requests.post("http://localhost:3001/api/paste", json={
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
    print(f"Decryption Link: https://example.com/#p={paste_id}&k={key.hex()}")`,

  go: `// Go Sovereign Encrypted Secret Pusher
package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"io"
)

func EncryptSecret(secret []byte) (key []byte, iv []byte, ct []byte, err error) {
	key = make([]byte, 32)
	rand.Read(key)
	
	block, _ := aes.NewCipher(key)
	gcm, _ := cipher.NewGCM(block)
	
	iv = make([]byte, gcm.NonceSize())
	io.ReadFull(rand.Reader, iv)
	
	ct = gcm.Seal(nil, iv, secret, []byte("cipherdrop-v2"))
	return key, iv, ct, nil
}`,

  rust: `// Rust Zero-Knowledge Secret Pusher (aes-gcm crate)
use aes_gcm::{Aes256Gcm, KeyInit, aead::Aead, Nonce};
use rand::RngCore;

fn encrypt_secret(plain: &[u8]) -> (Vec<u8>, Vec<u8>, Vec<u8>) {
    let mut key_bytes = [0u8; 32];
    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut key_bytes);
    rand::thread_rng().fill_bytes(&mut nonce_bytes);

    let cipher = Aes256Gcm::new_from_slice(&key_bytes).unwrap();
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher.encrypt(nonce, plain).unwrap();

    (key_bytes.to_vec(), nonce_bytes.to_vec(), ciphertext)
}`
};

export const ApiCliHub: React.FC = () => {
  const [activeLang, setActiveLang] = useState<keyof typeof SNIPPETS>('curl');
  const [copied, setCopied] = useState<boolean>(false);

  const copyCode = async () => {
    await navigator.clipboard.writeText(SNIPPETS[activeLang]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Intro */}
      <div className="glass-panel p-6 rounded-3xl border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Terminal className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              Developer API & CLI Hub
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                REST & WebSockets
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Integrate zero-knowledge secret pipelines into your CI/CD, CLI scripts, and server workflows.
            </p>
          </div>
        </div>
      </div>

      {/* Code Snippets Box */}
      <div className="glass-panel rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
        
        {/* Languages Tabs */}
        <div className="flex items-center justify-between px-6 py-3 bg-obsidian-950 border-b border-white/5">
          <div className="flex items-center gap-1">
            {(['curl', 'javascript', 'python', 'go', 'rust'] as const).map(lang => (
              <button
                key={lang}
                onClick={() => setActiveLang(lang)}
                className={`px-3 py-1 text-xs font-mono font-semibold rounded-lg transition-all ${
                  activeLang === lang
                    ? 'bg-emerald-500 text-obsidian-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            onClick={copyCode}
            className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 font-mono"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied Snippet' : 'Copy Code'}</span>
          </button>
        </div>

        {/* Code Content */}
        <pre className="p-6 bg-obsidian-950/80 font-mono text-xs text-emerald-200 overflow-x-auto leading-relaxed selection:bg-emerald-500/40">
          <code>{SNIPPETS[activeLang]}</code>
        </pre>
      </div>

      {/* REST API Endpoints Table */}
      <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-4 shadow-xl">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
          Core REST API Reference
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-white/10 text-slate-500 text-[10px]">
                <th className="pb-2">METHOD</th>
                <th className="pb-2">ENDPOINT</th>
                <th className="pb-2">DESCRIPTION</th>
                <th className="pb-2">SECURITY</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              <tr>
                <td className="py-2.5 text-emerald-400 font-bold">POST</td>
                <td className="py-2.5 text-slate-100">/api/paste</td>
                <td className="py-2.5 text-slate-400">Stores blind ciphertext payload</td>
                <td className="py-2.5 text-emerald-400">Zero-Knowledge</td>
              </tr>
              <tr>
                <td className="py-2.5 text-sky-400 font-bold">GET</td>
                <td className="py-2.5 text-slate-100">/api/paste/:id</td>
                <td className="py-2.5 text-slate-400">Atomic read and decrement / auto burn</td>
                <td className="py-2.5 text-emerald-400">Zero-Knowledge</td>
              </tr>
              <tr>
                <td className="py-2.5 text-rose-400 font-bold">DELETE</td>
                <td className="py-2.5 text-slate-100">/api/paste/:id</td>
                <td className="py-2.5 text-slate-400">Manual instant burn with deletion token</td>
                <td className="py-2.5 text-slate-300">Token Auth</td>
              </tr>
              <tr>
                <td className="py-2.5 text-emerald-400 font-bold">POST</td>
                <td className="py-2.5 text-slate-100">/api/request-drop</td>
                <td className="py-2.5 text-slate-400">Creates an inbound public key drop link</td>
                <td className="py-2.5 text-emerald-400">RSA-OAEP</td>
              </tr>
              <tr>
                <td className="py-2.5 text-amber-400 font-bold">WS</td>
                <td className="py-2.5 text-slate-100">/ws/incident-room</td>
                <td className="py-2.5 text-slate-400">Real-time collaborative E2EE live relay</td>
                <td className="py-2.5 text-emerald-400">Blind WSS Relay</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
