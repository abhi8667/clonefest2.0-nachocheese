import React, { useState } from 'react';
import { 
  Lock, 
  Unlock, 
  ShieldCheck, 
  Copy, 
  Check, 
  KeyRound, 
  Cpu, 
  Sparkles,
  WifiOff
} from 'lucide-react';
import { 
  generateMasterKey, 
  encryptSecret, 
  decryptSecret 
} from '../crypto/webcrypto';
import { DecryptedSecret } from '../types';
import { FeatureHighlights } from './FeatureHighlights';
import { TerminalWindow } from './TerminalWindow';

export const LocalVault: React.FC = () => {
  const [mode, setMode] = useState<'encrypt' | 'decrypt'>('encrypt');
  
  // Encrypt State
  const [plaintext, setPlaintext] = useState<string>('DATABASE_URL=postgres://user:pass@localhost:5432/secrets');
  const [password, setPassword] = useState<string>('');
  const [generatedKey, setGeneratedKey] = useState<string>('');
  const [encryptedOutput, setEncryptedOutput] = useState<string>('');
  const [copiedCipher, setCopiedCipher] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);

  // Decrypt State
  const [ciphertextInput, setCiphertextInput] = useState<string>('');
  const [decryptKeyInput, setDecryptKeyInput] = useState<string>('');
  const [decryptPasswordInput, setDecryptPasswordInput] = useState<string>('');
  const [decryptedOutput, setDecryptedOutput] = useState<string>('');
  const [decryptError, setDecryptError] = useState<string | null>(null);

  // Run Local Offline Encryption
  const handleLocalEncrypt = async () => {
    if (!plaintext.trim()) return;
    const masterKey = generateMasterKey();
    setGeneratedKey(masterKey);

    const payload: DecryptedSecret = {
      text: plaintext.trim(),
      formatter: 'plaintext',
    };

    const encrypted = await encryptSecret(payload, masterKey, {
      password: password.trim() || undefined,
    });

    setEncryptedOutput(JSON.stringify(encrypted, null, 2));
  };

  // Run Local Offline Decryption
  const handleLocalDecrypt = async () => {
    if (!ciphertextInput.trim() || !decryptKeyInput.trim()) return;
    try {
      setDecryptError(null);
      const parsed = JSON.parse(ciphertextInput.trim());
      const decrypted = await decryptSecret(parsed, decryptKeyInput.trim(), decryptPasswordInput.trim() || undefined);
      setDecryptedOutput(decrypted.text);
    } catch (err: any) {
      setDecryptError('Decryption failed. Ensure the JSON payload and key are valid.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Intro Header */}
      <TerminalWindow path="anonymous@crypton — vault --offline" glow>
      <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <WifiOff className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-mono text-base font-bold text-slate-100 flex items-center gap-2">
              Offline Cryptographic Sandbox
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                100% Air-Gapped
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Encrypt and decrypt strings and credentials strictly in browser memory. Zero network requests.
            </p>
          </div>
        </div>

        {/* Mode switcher */}
        <div className="flex bg-obsidian-950 p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setMode('encrypt')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              mode === 'encrypt' ? 'bg-emerald-500 text-obsidian-950 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Encrypt Sandbox
          </button>
          <button
            onClick={() => setMode('decrypt')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              mode === 'decrypt' ? 'bg-emerald-500 text-obsidian-950 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Decrypt Sandbox
          </button>
        </div>
      </div>
      </TerminalWindow>

      {mode === 'encrypt' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <TerminalWindow path="anonymous@crypton — vault/input" stagger={1}>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-300 uppercase mb-1">
                Plaintext Payload
              </label>
              <textarea
                value={plaintext}
                onChange={(e) => setPlaintext(e.target.value)}
                placeholder="Enter secret text…"
                rows={6}
                className="w-full glass-input p-3 rounded-xl text-xs font-mono text-emerald-200 resize-none focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 uppercase mb-1">
                Optional Passphrase (PBKDF2 600,000 rounds)
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter passphrase (optional)…"
                className="w-full glass-input px-3 py-2 rounded-xl text-xs font-mono text-slate-100"
              />
            </div>

            <button
              onClick={handleLocalEncrypt}
              className="btn-cyber-primary w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold"
            >
              <Sparkles className="w-4 h-4" />
              <span>Execute WebCrypto Encryption</span>
            </button>
          </div>
          </TerminalWindow>

          <TerminalWindow path="anonymous@crypton — vault/output" stagger={2}>
          <div className="p-6 space-y-4">
            <h3 className="text-xs font-mono font-bold uppercase text-emerald-400">
              Generated Ciphertext & Key
            </h3>

            {encryptedOutput ? (
              <div className="space-y-4">
                <div className="p-3 bg-obsidian-950 rounded-xl border border-white/10 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400 uppercase">Master Decryption Key (Base58)</span>
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(generatedKey);
                        setCopiedKey(true);
                        setTimeout(() => setCopiedKey(false), 2000);
                      }}
                      className="text-xs text-emerald-400 flex items-center gap-1 font-mono"
                    >
                      {copiedKey ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3 text-emerald-400" />}
                      <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <p className="text-xs font-mono text-emerald-300 truncate">{generatedKey}</p>
                </div>

                <div className="p-3 bg-obsidian-950 rounded-xl border border-white/10 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400 uppercase">Encrypted JSON Structure</span>
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(encryptedOutput);
                        setCopiedCipher(true);
                        setTimeout(() => setCopiedCipher(false), 2000);
                      }}
                      className="text-xs text-emerald-400 flex items-center gap-1 font-mono"
                    >
                      {copiedCipher ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3 text-emerald-400" />}
                      <span>{copiedCipher ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="text-[11px] font-mono text-slate-300 max-h-40 overflow-y-auto overflow-x-hidden whitespace-pre-wrap">
                    {encryptedOutput}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-xs text-slate-500 font-mono text-center">
                Click "Execute WebCrypto Encryption" to generate ciphertext.
              </div>
            )}
          </div>
          </TerminalWindow>
        </div>
      ) : (
        /* Decrypt Sandbox */
        <div className="max-w-2xl mx-auto">
        <TerminalWindow path="anonymous@crypton — vault/decrypt">
        <div className="p-6 sm:p-8 space-y-4">
          <div>
            <label className="block text-xs font-mono text-slate-300 uppercase mb-1">
              Encrypted JSON Payload
            </label>
            <textarea
              value={ciphertextInput}
              onChange={(e) => setCiphertextInput(e.target.value)}
              placeholder='Paste { "v": 2, "ct": "…", "iv": "…" }'
              rows={4}
              className="w-full glass-input p-3 rounded-xl text-xs font-mono text-slate-200 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono text-slate-300 uppercase mb-1">
                Base58 Master Key
              </label>
              <input
                type="text"
                value={decryptKeyInput}
                onChange={(e) => setDecryptKeyInput(e.target.value)}
                placeholder="Enter master key…"
                className="w-full glass-input px-3 py-2 rounded-xl text-xs font-mono text-emerald-300"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-300 uppercase mb-1">
                Passphrase (if any)
              </label>
              <input
                type="password"
                value={decryptPasswordInput}
                onChange={(e) => setDecryptPasswordInput(e.target.value)}
                placeholder="Enter passphrase…"
                className="w-full glass-input px-3 py-2 rounded-xl text-xs font-mono text-slate-200"
              />
            </div>
          </div>

          {decryptError && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
              {decryptError}
            </div>
          )}

          <button
            onClick={handleLocalDecrypt}
            className="btn-cyber-primary w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold"
          >
            <Unlock className="w-4 h-4" />
            <span>Execute Local Decryption</span>
          </button>

          {decryptedOutput && (
            <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl space-y-2">
              <span className="text-xs font-bold font-mono text-emerald-400">Decrypted Plaintext Output</span>
              <pre className="p-3 bg-obsidian-950 rounded-xl text-xs font-mono text-emerald-200 overflow-x-auto selection:bg-emerald-500/40">
                <code>{decryptedOutput}</code>
              </pre>
            </div>
          )}
        </div>
        </TerminalWindow>
        </div>
      )}

      <FeatureHighlights
        title="Air-Gapped Security"
        cards={[
          { icon: <WifiOff className="w-5 h-5" />, title: '100% Offline', description: 'Zero network requests. All encryption and decryption happens locally in browser memory.' },
          { icon: <Cpu className="w-5 h-5" />, title: 'WebCrypto Native', description: 'Uses hardware-accelerated W3C Web Cryptography API for maximum performance.' },
          { icon: <ShieldCheck className="w-5 h-5" />, title: 'Air-Gap Safe', description: 'Designed for isolated workstations and classified environments with no connectivity.' },
          { icon: <KeyRound className="w-5 h-5" />, title: 'QR Code Export', description: 'Generate high-density QR codes for optical transfer to mobile devices.' },
        ]}
      />

    </div>
  );
};
