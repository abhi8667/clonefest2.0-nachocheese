import React, { useState, useRef, useEffect } from 'react';
import { 
  Lock, 
  FileCode, 
  FileText, 
  ListOrdered, 
  Paperclip, 
  Flame, 
  Clock, 
  Eye, 
  MessageSquare, 
  ShieldAlert, 
  KeyRound, 
  Sparkles, 
  Plus, 
  Trash2, 
  EyeOff, 
  Check, 
  X, 
  UploadCloud, 
  File, 
  AlertCircle, 
  Users, 
  Link as LinkIcon, 
  ShieldCheck, 
  UserCheck, 
  SlidersHorizontal, 
  ChevronDown,
  Fingerprint,
  Cpu,
  Share2
} from 'lucide-react';
import { SecretFormatter, FileAttachment, DecryptedSecret, CreatedSecretResult, KdfType } from '../types';
import { generateMasterKey, encryptSecret, encryptMultiRecipientSecret, encryptQuorumSecret } from '../crypto/webcrypto';
import { TerminalWindow } from './TerminalWindow';
import { cyberAudio } from '../utils/cyberAudio';

interface SecretEditorProps {
  onSecretCreated: (result: CreatedSecretResult) => void;
  initialText?: string;
  initialFormatter?: SecretFormatter;
  uiMode?: 'guided' | 'operator';
}

const LANGUAGES = [
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'python', label: 'Python' },
  { id: 'rust', label: 'Rust' },
  { id: 'go', label: 'Go' },
  { id: 'sql', label: 'SQL' },
  { id: 'bash', label: 'Bash / Shell' },
  { id: 'json', label: 'JSON' },
  { id: 'yaml', label: 'YAML' },
  { id: 'dockerfile', label: 'Dockerfile' },
  { id: 'html', label: 'HTML / CSS' },
  { id: 'cpp', label: 'C / C++' },
  { id: 'java', label: 'Java' },
];

interface SlotEditorItem {
  id: string;
  label: string;
  burnOnRead: boolean;
  password: string;
}

function estimatePasswordStrength(pass: string): { entropy: number; score: number; crackTime: string; label: string; color: string } {
  if (!pass) return { entropy: 0, score: 0, crackTime: 'Instant', label: 'Empty', color: 'text-slate-500' };
  let poolSize = 0;
  if (/[a-z]/.test(pass)) poolSize += 26;
  if (/[A-Z]/.test(pass)) poolSize += 26;
  if (/[0-9]/.test(pass)) poolSize += 10;
  if (/[^a-zA-Z0-9]/.test(pass)) poolSize += 32;

  const entropy = Math.round(pass.length * Math.log2(poolSize || 1));
  let score = 1;
  let crackTime = '< 1 second';
  let label = 'Very Weak';
  let color = 'text-red-400';

  if (entropy >= 80) {
    score = 4;
    crackTime = '> 100 Billion Years (Quantum-Resistant)';
    label = 'Military Grade';
    color = 'text-emerald-400';
  } else if (entropy >= 60) {
    score = 3;
    crackTime = '~ 45,000 Years';
    label = 'Extremely Strong';
    color = 'text-emerald-300';
  } else if (entropy >= 45) {
    score = 2;
    crackTime = '~ 3 Months';
    label = 'Moderate';
    color = 'text-amber-400';
  } else if (entropy >= 28) {
    score = 1;
    crackTime = '~ 4 Minutes';
    label = 'Weak';
    color = 'text-rose-400';
  }

  return { entropy, score, crackTime, label, color };
}

export const SecretEditor: React.FC<SecretEditorProps> = ({ onSecretCreated, initialText, initialFormatter, uiMode = 'guided' }) => {
  // Guided mode is the "just share a secret" experience: no format switching,
  // no multi-party/quorum architecture, no KDF choice, no duress mode — those
  // are all operator-only. This isn't a re-skin, it's a different feature set.
  const isGuided = uiMode === 'guided';

  // Progressive disclosure: hide Duress / Time-Lock / Multi-Recipient / Quorum behind an Advanced toggle
  // (operator-only — guided mode never renders the toggle, so this can never flip true there)
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // Sharing Mode: Standard (Single Key) vs Multi-Recipient Envelopes vs Quorum Unlock (Shamir M-of-N)
  const [sharingMode, setSharingMode] = useState<'standard' | 'multi' | 'quorum'>('standard');

  // Multi-Recipient Slots State
  const [recipients, setRecipients] = useState<SlotEditorItem[]>([
    { id: '1', label: 'Alice', burnOnRead: true, password: '' },
    { id: '2', label: 'Bob', burnOnRead: true, password: '' },
  ]);
  const [watermarkEnvelopes, setWatermarkEnvelopes] = useState<boolean>(true);

  // Quorum Unlock (M-of-N Shamir Secret Sharing) State
  const [quorumThreshold, setQuorumThreshold] = useState<number>(2);
  const [quorumTotalShares, setQuorumTotalShares] = useState<number>(3);
  const [quorumTrustees, setQuorumTrustees] = useState<string[]>([
    'Alice (Security Lead)',
    'Bob (Infrastructure)',
    'Charlie (Legal / Compliance)',
  ]);

  // Mode & Content State — guided mode has no format tabs, so it stays on
  // plaintext; operator defaults to code (matches the tab bar it can see).
  const [formatter, setFormatter] = useState<SecretFormatter>(initialFormatter || (isGuided ? 'plaintext' : 'code'));
  const [language, setLanguage] = useState<string>('javascript');
  const [text, setText] = useState<string>(initialText || '');
  
  // Update state if initialText or initialFormatter prop changes
  useEffect(() => {
    if (initialText !== undefined) {
      setText(initialText);
      if (initialFormatter === 'env') {
        setFormatter('env');
        const lines = initialText.split('\n');
        const entries = lines.filter(l => l.includes('=')).map(l => {
          const idx = l.indexOf('=');
          return { key: l.slice(0, idx).trim(), value: l.slice(idx + 1).trim(), masked: true };
        });
        if (entries.length > 0) {
          setEnvEntries(entries);
        }
      } else if (initialFormatter) {
        setFormatter(initialFormatter);
      }
    }
  }, [initialText, initialFormatter]);

  // Structured ENV State
  const [envEntries, setEnvEntries] = useState<{ key: string; value: string; masked: boolean }[]>([
    { key: 'DATABASE_URL', value: 'postgresql://postgres:secretpassword@prod-db.internal:5432/main', masked: true },
    { key: 'API_SECRET_KEY', value: 'sk_live_984f873d9e284b810928374d', masked: true },
  ]);

  // File Attachment State
  const [attachment, setAttachment] = useState<FileAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Security & Expiry Controls
  const [expireOption, setExpireOption] = useState<string>('1day');
  const [burnAfterReading, setBurnAfterReading] = useState<boolean>(false);
  const [maxViews, setMaxViews] = useState<number>(-1);
  const [openDiscussion, setOpenDiscussion] = useState<boolean>(true);

  // Password Protection & KDF (Argon2id vs PBKDF2)
  const [usePassword, setUsePassword] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [kdfChoice, setKdfChoice] = useState<KdfType>('argon2id');
  const [useDuress, setUseDuress] = useState<boolean>(false);
  const [duressPassword, setDuressPassword] = useState<string>('');
  const [decoyText, setDecoyText] = useState<string>(
    '# General Server Maintenance Notes\n- Scheduled OS update on Monday 02:00 UTC\n- Contact admin@example.com for queries.'
  );

  // Time-Lock Secrets State (Server-Assisted Release)
  const defaultUnlockDate = new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0];
  const [timeLockEnabled, setTimeLockEnabled] = useState<boolean>(false);
  const [unlockDate, setUnlockDate] = useState<string>(defaultUnlockDate);
  const [unlockTime, setUnlockTime] = useState<string>('12:00');
  const [unlockTimezone, setUnlockTimezone] = useState<'UTC' | 'local'>('UTC');

  // UI status
  const [isEncrypting, setIsEncrypting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Count of active advanced features, shown as a badge on the Advanced toggle
  const advancedFeatureCount =
    (sharingMode !== 'standard' ? 1 : 0) + (useDuress ? 1 : 0) + (timeLockEnabled ? 1 : 0) + (kdfChoice === 'argon2id' && usePassword ? 1 : 0);

  // Auto-convert ENV entries to text when in env mode
  const getCompiledEnvText = () => {
    return envEntries
      .filter(e => e.key.trim().length > 0)
      .map(e => `${e.key.trim()}=${e.value}`)
      .join('\n');
  };

  // Keyboard shortcut: Cmd/Ctrl + Enter to publish
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleCreateSecret();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    text, envEntries, formatter, language, attachment, expireOption, burnAfterReading,
    maxViews, openDiscussion, usePassword, password, kdfChoice, useDuress, duressPassword, decoyText,
    timeLockEnabled, unlockDate, unlockTime, unlockTimezone, sharingMode, recipients, watermarkEnvelopes,
    quorumThreshold, quorumTotalShares, quorumTrustees
  ]);

  // Handle File Drag & Drop
  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const processFile = (file: globalThis.File) => {
    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage('File size exceeds maximum zero-knowledge client limit of 15MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAttachment({
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        data: ev.target?.result as string,
      });
    };
    reader.readAsDataURL(file);
  };

  // Calculate Expiry Seconds
  const getExpireSeconds = (option: string): number => {
    switch (option) {
      case '5min': return 300;
      case '15min': return 900;
      case '1hour': return 3600;
      case '1day': return 86400;
      case '7days': return 604800;
      case '30days': return 2592000;
      case 'never': return 0;
      default: return 86400;
    }
  };

  // Add a new recipient slot
  const handleAddRecipient = () => {
    const nextIdx = recipients.length + 1;
    setRecipients([
      ...recipients,
      { id: Date.now().toString(), label: `Recipient ${nextIdx}`, burnOnRead: true, password: '' }
    ]);
  };

  // Remove a recipient slot
  const handleRemoveRecipient = (id: string) => {
    if (recipients.length <= 1) return;
    setRecipients(recipients.filter(r => r.id !== id));
  };

  // Update a recipient slot
  const handleUpdateRecipient = (id: string, updates: Partial<SlotEditorItem>) => {
    setRecipients(recipients.map(r => (r.id === id ? { ...r, ...updates } : r)));
  };

  // Update Quorum total shares and adjust trustees list
  const handleQuorumTotalSharesChange = (newTotal: number) => {
    setQuorumTotalShares(newTotal);
    if (quorumThreshold > newTotal) {
      setQuorumThreshold(newTotal);
    }
    const updated = [...quorumTrustees];
    while (updated.length < newTotal) {
      updated.push(`Trustee ${updated.length + 1}`);
    }
    setQuorumTrustees(updated.slice(0, newTotal));
  };

  // Time-Lock Helpers
  const getUnlockIsoString = (): string | null => {
    if (!timeLockEnabled || !unlockDate || !unlockTime) return null;
    if (unlockTimezone === 'UTC') {
      return `${unlockDate}T${unlockTime}:00.000Z`;
    } else {
      const [year, month, day] = unlockDate.split('-').map(Number);
      const [hours, minutes] = unlockTime.split(':').map(Number);
      const localDate = new Date(year, month - 1, day, hours, minutes, 0);
      return localDate.toISOString();
    }
  };

  const getUnlockPreview = () => {
    const iso = getUnlockIsoString();
    if (!iso) return null;
    const target = new Date(iso).getTime();
    const now = Date.now();
    const diffSec = Math.floor((target - now) / 1000);
    if (isNaN(target) || diffSec <= 0) {
      return { valid: false, message: 'Unlock date & time must be in the future.' };
    }
    const d = Math.floor(diffSec / 86400);
    const h = Math.floor((diffSec % 86400) / 3600);
    const m = Math.floor((diffSec % 3600) / 60);
    const formattedDuration = `${d > 0 ? `${d}d ` : ''}${h > 0 ? `${h}h ` : ''}${m}m`;
    const dateObj = new Date(iso);
    const utcString = dateObj.toUTCString();
    const localString = dateObj.toLocaleString();
    return {
      valid: true,
      iso,
      utcString,
      localString,
      formattedDuration,
    };
  };

  // Main Submit Handler
  const handleCreateSecret = async () => {
    try {
      setErrorMessage(null);
      let content = text;
      if (formatter === 'env') {
        content = getCompiledEnvText();
      }

      if (!content.trim() && !attachment) {
        setErrorMessage('Please enter some text, code, or attach a confidential file.');
        return;
      }

      if (sharingMode === 'standard' && usePassword && !password.trim()) {
        setErrorMessage('Password protection is enabled. Please enter a password or disable the option.');
        return;
      }

      if (sharingMode === 'multi') {
        if (recipients.length === 0) {
          setErrorMessage('Please add at least one recipient for Multi-Recipient Envelope encryption.');
          return;
        }
        for (const r of recipients) {
          if (!r.label.trim()) {
            setErrorMessage('All recipient slots must have a label or name.');
            return;
          }
        }
      }

      if (sharingMode === 'quorum') {
        if (quorumThreshold > quorumTotalShares) {
          setErrorMessage('Quorum threshold M cannot be greater than Total Shares N.');
          return;
        }
        if (quorumThreshold < 2) {
          setErrorMessage('Quorum threshold M must be at least 2.');
          return;
        }
      }

      if (useDuress && (!duressPassword.trim() || !decoyText.trim())) {
        setErrorMessage('Duress mode requires both a Duress Password and a Decoy Message.');
        return;
      }

      if (useDuress && password.trim() === duressPassword.trim()) {
        setErrorMessage('Primary password and Duress password must be different.');
        return;
      }

      const isBurn = burnAfterReading || expireOption === 'burn';
      const expireSec = getExpireSeconds(expireOption);

      // Time-Lock Validation
      let unlockIso: string | null = null;
      if (timeLockEnabled) {
        unlockIso = getUnlockIsoString();
        if (!unlockIso) {
          setErrorMessage('Please select a valid unlock date and time.');
          return;
        }
        const unlockMs = new Date(unlockIso).getTime();
        if (isNaN(unlockMs) || unlockMs <= Date.now()) {
          setErrorMessage('Time-lock release time must be in the future.');
          return;
        }
        if (expireSec !== 0) {
          const expireMs = Date.now() + expireSec * 1000;
          if (unlockMs >= expireMs) {
            setErrorMessage('Time-lock unlock time must be earlier than the expiration (TTL) time.');
            return;
          }
        }
      }

      cyberAudio.playEncryptSweep();
      setIsEncrypting(true);

      // Prepare decrypted payload
      const secretPayload: DecryptedSecret = {
        text: content,
        formatter: formatter,
        language: formatter === 'code' ? language : undefined,
        attachment: attachment || undefined,
        commentsAllowed: openDiscussion && !isBurn,
      };

      const decoyPayload: DecryptedSecret | undefined = useDuress ? {
        text: decoyText,
        formatter: 'markdown',
        commentsAllowed: false,
      } : undefined;

      if (sharingMode === 'quorum') {
        // --- QUORUM UNLOCK (M-of-N SHAMIR'S SECRET SHARING) ---
        const quorumGenerated = await encryptQuorumSecret(
          secretPayload,
          quorumThreshold,
          quorumTotalShares,
          quorumTrustees,
          {
            password: usePassword ? password.trim() : undefined,
            duressPassword: useDuress ? duressPassword.trim() : undefined,
            decoyData: decoyPayload,
            authenticatedMeta: `cipherdrop-v2-quorum:${formatter}:${quorumThreshold}of${quorumTotalShares}`,
            kdf: kdfChoice,
          }
        );

        const response = await fetch('/api/paste', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payload: quorumGenerated.payload,
            isMultiRecipient: false,
            expireInSeconds: expireSec,
            burnAfterReading: isBurn,
            maxViews: isBurn ? 1 : maxViews,
            openDiscussion: openDiscussion && !isBurn,
            timeLockEnabled: Boolean(timeLockEnabled),
            unlockAt: unlockIso,
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Failed to save quorum secret on server.');
        }

        const result = await response.json();

        const quorumShares = quorumGenerated.shares.map(s => ({
          shareIndex: s.shareIndex,
          shareKey: s.shareKey,
          label: s.label,
          url: `${window.location.origin}/#p=${result.id}&k=${s.shareKey}&share=${s.shareIndex}`,
        }));

        onSecretCreated({
          pasteId: result.id,
          isQuorum: true,
          threshold: quorumThreshold,
          totalShares: quorumTotalShares,
          deleteToken: result.deleteToken,
          expireAt: result.expireAt,
          timeLockEnabled: Boolean(timeLockEnabled),
          unlockAt: result.unlockAt || unlockIso,
          quorumShares,
        });

      } else if (sharingMode === 'multi') {
        // --- MULTI-RECIPIENT ENVELOPE ENCRYPTION WITH OPTIONAL WATERMARKING ---
        const multiEncrypted = await encryptMultiRecipientSecret(
          secretPayload,
          recipients.map(r => ({
            label: r.label.trim(),
            burnOnRead: r.burnOnRead,
            password: r.password.trim() || undefined,
          })),
          {
            duressPassword: useDuress ? duressPassword.trim() : undefined,
            decoyData: decoyPayload,
            authenticatedMeta: `cipherdrop-v2-envelope:${formatter}`,
            watermarkEnvelopes: watermarkEnvelopes,
            kdf: kdfChoice,
          }
        );

        const response = await fetch('/api/paste', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payload: multiEncrypted.payload,
            isMultiRecipient: true,
            envelopes: multiEncrypted.envelopes,
            adminTokenHash: multiEncrypted.adminTokenHash,
            expireInSeconds: expireSec,
            burnAfterReading: false,
            maxViews: -1,
            openDiscussion: openDiscussion && !isBurn,
            timeLockEnabled: Boolean(timeLockEnabled),
            unlockAt: unlockIso,
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Failed to save multi-recipient envelopes on server.');
        }

        const result = await response.json();

        const recipientLinks = multiEncrypted.recipientSecrets.map(r => ({
          slotId: r.slotId,
          label: r.label,
          slotKey: r.slotKey,
          url: `${window.location.origin}/#p=${result.id}&slot=${r.slotId}&k=${r.slotKey}`,
          burnOnRead: r.burnOnRead,
          hasPassword: r.hasPassword,
          watermarked: r.watermarked,
        }));

        const adminUrl = `${window.location.origin}/#admin=${result.id}&token=${multiEncrypted.adminToken}`;

        onSecretCreated({
          pasteId: result.id,
          isMultiRecipient: true,
          adminToken: multiEncrypted.adminToken,
          adminUrl,
          deleteToken: result.deleteToken,
          expireAt: result.expireAt,
          timeLockEnabled: Boolean(timeLockEnabled),
          unlockAt: result.unlockAt || unlockIso,
          recipientLinks,
        });

      } else {
        // --- STANDARD SINGLE-LINK ENCRYPTION ---
        const masterKey = generateMasterKey();

        const encrypted = await encryptSecret(secretPayload, masterKey, {
          password: usePassword ? password.trim() : undefined,
          duressPassword: useDuress ? duressPassword.trim() : undefined,
          decoyData: decoyPayload,
          authenticatedMeta: `cipherdrop-v2:${formatter}:${isBurn ? 1 : 0}`,
          kdf: kdfChoice,
        });

        const response = await fetch('/api/paste', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payload: encrypted,
            expireInSeconds: expireSec,
            burnAfterReading: isBurn,
            maxViews: isBurn ? 1 : maxViews,
            openDiscussion: openDiscussion && !isBurn,
            timeLockEnabled: Boolean(timeLockEnabled),
            unlockAt: unlockIso,
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Failed to save encrypted secret on server.');
        }

        const result = await response.json();

        onSecretCreated({
          pasteId: result.id,
          isMultiRecipient: false,
          masterKey: masterKey,
          deleteToken: result.deleteToken,
          expireAt: result.expireAt,
          burnAfterReading: isBurn,
          timeLockEnabled: Boolean(timeLockEnabled),
          unlockAt: result.unlockAt || unlockIso,
        });
      }

    } catch (err: any) {
      console.error('Encryption error:', err);
      setErrorMessage(err.message || 'An error occurred while encrypting secret.');
    } finally {
      setIsEncrypting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
    <TerminalWindow path="anonymous@crypton — new-secret" glow stagger={2}>
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleCreateSecret();
      }}
      className="space-y-6 p-6"
    >

      {/* Advanced Options Bar — operator only. Guided mode never sees the
          multi-party/quorum/duress/KDF surface at all, not even collapsed. */}
      {!isGuided && (
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-obsidian-950 rounded-2xl border border-white/5">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-xs font-mono text-slate-300 hover:text-emerald-400 transition-colors"
        >
          <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
          <span className="font-bold">Cryptographic Options & Multi-Party Architecture</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showAdvanced ? 'rotate-180 text-emerald-400' : ''}`} />
          {advancedFeatureCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              {advancedFeatureCount} active
            </span>
          )}
        </button>

        <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
          Argon2id KDF • Shamir Quorum • Watermarking • Decoy Mode
        </span>
      </div>
      )}

      {/* Sharing Mode Switcher */}
      {showAdvanced && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-obsidian-950 rounded-2xl border border-white/10 animate-fadeIn">
          <div>
            <span className="text-xs font-bold text-slate-200 block">Cryptographic Distribution Architecture:</span>
            <span className="text-[11px] text-slate-400">
              {sharingMode === 'standard' && 'Single sovereign key with zero-knowledge decryption link.'}
              {sharingMode === 'multi' && 'Independent wrapped envelopes for N recipients with per-slot burning & selective revocation.'}
              {sharingMode === 'quorum' && 'M-of-N Shamir Secret Sharing: Requires M trustees to combine shares before anyone can decrypt.'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1 bg-obsidian-900 p-1 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => setSharingMode('standard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                sharingMode === 'standard' ? 'bg-emerald-500 text-obsidian-950 font-bold shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              Standard
            </button>
            <button
              type="button"
              onClick={() => setSharingMode('multi')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                sharingMode === 'multi' ? 'bg-emerald-500 text-obsidian-950 font-bold shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Multi-Recipient
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                sharingMode === 'multi' ? 'bg-obsidian-950 text-emerald-400' : 'bg-white/10 text-slate-300'
              }`}>
                {recipients.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSharingMode('quorum')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                sharingMode === 'quorum' ? 'bg-emerald-500 text-obsidian-950 font-bold shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Share2 className="w-3.5 h-3.5" />
              Quorum Unlock (Shamir)
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                sharingMode === 'quorum' ? 'bg-obsidian-950 text-emerald-400' : 'bg-white/10 text-slate-300'
              }`}>
                {quorumThreshold}/{quorumTotalShares}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Quorum Unlock Configuration Drawer */}
      {showAdvanced && sharingMode === 'quorum' && (
        <div className="glass-panel p-5 rounded-2xl border border-emerald-500/30 bg-emerald-950/10 space-y-4 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Share2 className="w-4 h-4 text-emerald-400" />
                Quorum Threshold Configuration (M-of-N Shamir's Secret Sharing)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                The master Content Encryption Key (CEK) will be split into polynomial shares over GF(2^8). Any <strong>{quorumThreshold}</strong> of the <strong>{quorumTotalShares}</strong> trustees must collaborate and enter their shares to decrypt the secret.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 bg-obsidian-950 rounded-xl border border-white/10 space-y-2">
              <label className="block text-xs font-mono text-slate-300 font-bold">
                Threshold M (Shares Needed to Decrypt):
              </label>
              <select
                value={quorumThreshold}
                onChange={(e) => setQuorumThreshold(Number(e.target.value))}
                className="w-full bg-obsidian-900 border border-white/10 text-xs text-emerald-400 rounded-lg p-2 font-mono focus:border-emerald-500 focus:outline-none"
              >
                {Array.from({ length: quorumTotalShares - 1 }, (_, i) => i + 2).map(n => (
                  <option key={n} value={n}>{n} of {quorumTotalShares} Approvals Required</option>
                ))}
              </select>
              <span className="text-[11px] text-slate-500 block font-mono">
                Fewer than {quorumThreshold} shares reveal 0 bits of information.
              </span>
            </div>

            <div className="p-3 bg-obsidian-950 rounded-xl border border-white/10 space-y-2">
              <label className="block text-xs font-mono text-slate-300 font-bold">
                Total Shares N (Distributed Trustees):
              </label>
              <select
                value={quorumTotalShares}
                onChange={(e) => handleQuorumTotalSharesChange(Number(e.target.value))}
                className="w-full bg-obsidian-900 border border-white/10 text-xs text-slate-200 rounded-lg p-2 font-mono focus:border-emerald-500 focus:outline-none"
              >
                {[2, 3, 4, 5, 6, 7, 8, 10].map(n => (
                  <option key={n} value={n}>{n} Total Trustee Shares</option>
                ))}
              </select>
              <span className="text-[11px] text-slate-500 block font-mono">
                Total individual share links to generate and distribute.
              </span>
            </div>
          </div>

          {/* Trustee Labels */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
              Trustee Roles & Labels ({quorumTrustees.length})
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {quorumTrustees.map((label, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-obsidian-950 rounded-lg border border-white/5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-mono font-bold flex items-center justify-center border border-emerald-500/20 flex-shrink-0">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => {
                      const updated = [...quorumTrustees];
                      updated[idx] = e.target.value;
                      setQuorumTrustees(updated);
                    }}
                    placeholder={`Trustee ${idx + 1} Name`}
                    className="bg-transparent text-xs font-mono text-slate-200 focus:outline-none focus:text-emerald-300 border-b border-transparent focus:border-emerald-500 flex-1"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Multi-Recipient Slots Configuration Drawer */}
      {showAdvanced && sharingMode === 'multi' && (
        <div className="glass-panel p-5 rounded-2xl border border-emerald-500/30 bg-emerald-950/10 space-y-4 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                Multi-Recipient Envelopes Configuration ({recipients.length} People)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                The payload will be encrypted once. Each person receives an isolated link with their own wrapped key, independent burn-after-reading, and selective revocation.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddRecipient}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              + Add Recipient Slot
            </button>
          </div>

          {/* Watermarking Option */}
          <div className="p-3 bg-obsidian-950 rounded-xl border border-white/10 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <label className="flex items-center gap-2 text-xs text-slate-200 font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={watermarkEnvelopes}
                  onChange={(e) => setWatermarkEnvelopes(e.target.checked)}
                  className="rounded border-white/20 bg-obsidian-900 text-emerald-500 focus:ring-emerald-500/20 w-4 h-4"
                />
                <Fingerprint className="w-4 h-4 text-emerald-400" />
                <span>Enable Leak-Traceable Watermarking (Forensic Attribution)</span>
              </label>
              <p className="text-[11px] text-slate-400 pl-6">
                Embeds an invisible recipient-keyed zero-width steganographic fingerprint in plaintext. If leaked, the source recipient can be forensically attributed with 100% precision.
              </p>
            </div>
            <span className="hidden sm:inline px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Zero-Width Stego
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recipients.map((r, idx) => (
              <div
                key={r.id}
                className="p-3.5 bg-obsidian-950 rounded-xl border border-white/10 space-y-2.5 relative group hover:border-emerald-500/30 transition-all"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-mono font-bold flex items-center justify-center border border-emerald-500/20">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={r.label}
                      onChange={(e) => handleUpdateRecipient(r.id, { label: e.target.value })}
                      placeholder={`Recipient ${idx + 1} Name`}
                      className="bg-transparent text-xs font-bold text-slate-200 focus:outline-none focus:text-emerald-300 border-b border-transparent focus:border-emerald-500 w-32"
                    />
                  </div>

                  {recipients.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveRecipient(r.id)}
                      className="text-slate-500 hover:text-rose-400 p-1.5 rounded transition-colors"
                      title="Remove recipient slot"
                      aria-label={`Remove recipient slot: ${r.label || `Recipient ${idx + 1}`}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="space-y-1.5 pt-1 border-t border-white/5 text-[11px]">
                  <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={r.burnOnRead}
                      onChange={(e) => handleUpdateRecipient(r.id, { burnOnRead: e.target.checked })}
                      className="rounded border-white/20 bg-obsidian-900 text-emerald-500 focus:ring-emerald-500/20 w-3.5 h-3.5"
                    />
                    <span className="flex items-center gap-1 text-slate-400">
                      <Flame className="w-3 h-3 text-rose-400" />
                      Burn slot on first read
                    </span>
                  </label>

                  <div className="pt-1">
                    <input
                      type="password"
                      value={r.password}
                      onChange={(e) => handleUpdateRecipient(r.id, { password: e.target.value })}
                      placeholder="Optional slot passphrase…"
                      autoComplete="off"
                      data-1p-ignore
                      data-lpignore="true"
                      className="w-full bg-obsidian-900 border border-white/10 px-2 py-1 rounded text-[11px] font-mono text-slate-200 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Editor Box */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
        
        {/* Editor Sub-Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-obsidian-950/80 border-b border-white/5">

          {/* Formatter Tabs — operator only. Guided mode is always plain
              text: no format switching, no language picker, one text box. */}
          {isGuided ? (
            <span className="text-xs font-mono text-slate-400">Your secret</span>
          ) : (
          <div className="flex items-center gap-1 bg-obsidian-900 p-1 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => setFormatter('code')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                formatter === 'code' ? 'bg-emerald-500 text-obsidian-950 font-bold shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              Code
            </button>

            <button
              type="button"
              onClick={() => setFormatter('markdown')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                formatter === 'markdown' ? 'bg-emerald-500 text-obsidian-950 font-bold shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Markdown
            </button>

            <button
              type="button"
              onClick={() => setFormatter('env')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                formatter === 'env' ? 'bg-emerald-500 text-obsidian-950 font-bold shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              .ENV Keys
            </button>

            <button
              type="button"
              onClick={() => setFormatter('plaintext')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                formatter === 'plaintext' ? 'bg-emerald-500 text-obsidian-950 font-bold shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Plaintext
            </button>
          </div>
          )}

          <div className="flex items-center gap-3">
            {!isGuided && formatter === 'code' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-mono">Language:</span>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="bg-obsidian-900 border border-white/10 text-xs text-slate-200 rounded-lg px-2.5 py-1 font-mono focus:border-emerald-500 focus:outline-none"
                >
                  {LANGUAGES.map(lang => (
                    <option key={lang.id} value={lang.id}>{lang.label}</option>
                  ))}
                </select>
              </div>
            )}
            {!isGuided && formatter === 'markdown' && (
              <span className="text-xs text-slate-400 font-mono">Live preview & Markdown</span>
            )}
            {!isGuided && formatter === 'env' && (
              <span className="text-xs text-slate-400 font-mono">Key-Value Secret Credentials</span>
            )}
            {!isGuided && formatter === 'plaintext' && (
              <span className="text-xs text-slate-400 font-mono">Raw Text</span>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-obsidian-900 hover:bg-white/5 border border-white/10 text-slate-300 transition-all"
            >
              <Paperclip className="w-3.5 h-3.5 text-emerald-400" />
              {attachment ? 'Replace File' : 'Attach File'}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
              className="hidden"
            />
          </div>
        </div>

        {/* Editor Body */}
        {formatter === 'code' || formatter === 'plaintext' ? (
          <div className="relative p-2 bg-obsidian-950">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                isGuided
                  ? 'Type or paste whatever you want to share — a password, a note, anything…'
                  : formatter === 'code'
                  ? '// Paste your sensitive code, private keys (PEM), or server configuration here…'
                  : 'Paste confidential message, passwords, or sensitive notes here…'
              }
              rows={14}
              className="w-full p-4 bg-transparent font-mono text-sm text-emerald-100 placeholder:text-slate-600 focus:outline-none resize-y leading-relaxed"
              spellCheck={false}
            />
          </div>
        ) : formatter === 'markdown' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/10 bg-obsidian-950">
            <div className="p-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="# Confidential Report&#10;&#10;Enter markdown text here…&#10;- Item 1&#10;- Item 2"
                rows={14}
                className="w-full p-4 bg-transparent font-mono text-sm text-emerald-100 placeholder:text-slate-600 focus:outline-none resize-y leading-relaxed"
              />
            </div>
            <div className="p-4 bg-obsidian-900/40 overflow-y-auto max-h-[360px] prose prose-invert prose-emerald text-sm">
              {text ? (
                <div className="whitespace-pre-wrap font-sans text-slate-200">
                  {text}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">Live preview will render here...</p>
              )}
            </div>
          </div>
        ) : (
          /* Structured ENV Editor */
          <div className="p-4 bg-obsidian-950 space-y-3">
            <div className="space-y-2">
              {envEntries.map((entry, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={entry.key}
                    onChange={(e) => {
                      const updated = [...envEntries];
                      updated[idx].key = e.target.value;
                      setEnvEntries(updated);
                    }}
                    placeholder="KEY_NAME"
                    className="w-1/3 glass-input px-3 py-2 rounded-lg text-xs font-mono text-emerald-400 uppercase"
                  />
                  <div className="relative flex-1">
                    <input
                      type={entry.masked ? 'password' : 'text'}
                      value={entry.value}
                      onChange={(e) => {
                        const updated = [...envEntries];
                        updated[idx].value = e.target.value;
                        setEnvEntries(updated);
                      }}
                      placeholder="value_secret_string"
                      autoComplete="off"
                      data-1p-ignore
                      data-lpignore="true"
                      className="w-full glass-input px-3 py-2 pr-9 rounded-lg text-xs font-mono text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const updated = [...envEntries];
                        updated[idx].masked = !updated[idx].masked;
                        setEnvEntries(updated);
                      }}
                      aria-label={entry.masked ? 'Show value' : 'Hide value'}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-200 rounded-md"
                    >
                      {entry.masked ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (envEntries.length > 1) {
                        setEnvEntries(envEntries.filter((_, i) => i !== idx));
                      }
                    }}
                    aria-label="Remove this key-value pair"
                    className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setEnvEntries([...envEntries, { key: '', value: '', masked: true }])}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Key-Value Pair
            </button>
          </div>
        )}

        {/* Attachment Pill (if attached) */}
        {attachment && (
          <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-950/30 border-t border-emerald-500/20 text-xs">
            <div className="flex items-center gap-2 text-emerald-300 font-mono">
              <File className="w-4 h-4 text-emerald-400" />
              <span>{attachment.name}</span>
              <span className="text-slate-500 font-sans">({(attachment.size / 1024).toFixed(1)} KB)</span>
            </div>
            <button
              type="button"
              onClick={() => setAttachment(null)}
              aria-label="Remove attached file"
              className="p-1 text-slate-400 hover:text-rose-400 transition-colors rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Drag Drop Overlay Zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileDrop}
          className="border-t border-dashed border-white/10 px-4 py-2 text-center text-xs text-slate-500 hover:text-slate-400 bg-obsidian-950/40 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <span>💡 {isGuided ? 'Or drop a file here to attach it' : 'Drag & drop any binary file (PDF, image, zip) here to encrypt client-side'}</span>
        </div>
      </div>

      {/* Advanced Security & Expiration Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Ephemeral Expiration Card */}
        <div className="glass-panel p-4 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">Expiration & Self-Destruct</h3>
            </div>
            {burnAfterReading && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30 font-mono">
                <Flame className="w-3 h-3" /> Burn on Read
              </span>
            )}
          </div>

          <div className={isGuided ? '' : 'grid grid-cols-2 gap-2'}>
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                {isGuided ? 'When should it disappear?' : 'Time to Live (TTL)'}
              </label>
              <select
                value={expireOption}
                onChange={(e) => setExpireOption(e.target.value)}
                className="w-full bg-obsidian-900 border border-white/10 text-xs text-slate-200 rounded-lg p-2 font-mono focus:border-emerald-500 focus:outline-none"
              >
                {isGuided ? (
                  <>
                    <option value="burn">🔥 After it's read once</option>
                    <option value="1hour">In 1 hour</option>
                    <option value="1day">In 1 day (default)</option>
                    <option value="7days">In 7 days</option>
                    <option value="never">Never expires</option>
                  </>
                ) : (
                  <>
                    <option value="burn">🔥 Burn after 1 view</option>
                    <option value="5min">5 Minutes</option>
                    <option value="15min">15 Minutes</option>
                    <option value="1hour">1 Hour</option>
                    <option value="1day">1 Day (Default)</option>
                    <option value="7days">7 Days</option>
                    <option value="30days">30 Days</option>
                    <option value="never">Never (Persistent)</option>
                  </>
                )}
              </select>
            </div>

            {!isGuided && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Max View Count</label>
              <select
                value={maxViews}
                onChange={(e) => setMaxViews(Number(e.target.value))}
                disabled={expireOption === 'burn'}
                className="w-full bg-obsidian-900 border border-white/10 text-xs text-slate-200 rounded-lg p-2 font-mono focus:border-emerald-500 focus:outline-none disabled:opacity-50"
              >
                <option value="-1">Unlimited Views</option>
                <option value="1">1 View (Auto Burn)</option>
                <option value="2">2 Views</option>
                <option value="5">5 Views</option>
                <option value="10">10 Views</option>
              </select>
            </div>
            )}
          </div>

          {!isGuided && (
          <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={openDiscussion && expireOption !== 'burn'}
                disabled={expireOption === 'burn'}
                onChange={(e) => setOpenDiscussion(e.target.checked)}
                className="rounded border-white/20 bg-obsidian-900 text-emerald-500 focus:ring-emerald-500/20"
              />
              <span className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                Allow Encrypted Comments
              </span>
            </label>
          </div>
          )}
        </div>

        {/* Password & Coercion Resistance Card */}
        <div className="glass-panel p-4 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">{isGuided ? 'Password' : 'Password & Hardening'}</h3>
            </div>
            {useDuress && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono">
                <ShieldAlert className="w-3 h-3" /> Stealth Decoy Active
              </span>
            )}
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={usePassword}
                onChange={(e) => setUsePassword(e.target.checked)}
                className="rounded border-white/20 bg-obsidian-900 text-emerald-500 focus:ring-emerald-500/20"
              />
              <span>{isGuided ? 'Protect with a password' : 'Require Decryption Passphrase'}</span>
            </label>

            {usePassword && (
              <div className="space-y-3 pt-1">
                <div className="space-y-1.5">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter strong primary passphrase…"
                    autoComplete="off"
                    data-1p-ignore
                    data-lpignore="true"
                    className="w-full glass-input px-3.5 py-2.5 rounded-xl text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:border-emerald-500/60"
                  />

                  {/* Real-time Entropy & Crack Time Gauge */}
                  {password && (
                    <div className="p-2.5 rounded-xl bg-obsidian-950/80 border border-white/10 space-y-1.5 font-mono text-[11px] animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-1">
                          <span>Entropy Strength:</span>
                          <span className={`font-bold ${estimatePasswordStrength(password).color}`}>
                            {estimatePasswordStrength(password).label} ({estimatePasswordStrength(password).entropy} bits)
                          </span>
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Estimated Crack: <span className="text-slate-200 font-bold">{estimatePasswordStrength(password).crackTime}</span>
                        </span>
                      </div>
                      
                      {/* Strength Segmented Bar */}
                      <div className="grid grid-cols-4 gap-1 h-1.5 w-full bg-obsidian-900 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${estimatePasswordStrength(password).score >= 1 ? 'bg-red-500' : 'bg-transparent'}`}></div>
                        <div className={`h-full rounded-full transition-all ${estimatePasswordStrength(password).score >= 2 ? 'bg-amber-500' : 'bg-transparent'}`}></div>
                        <div className={`h-full rounded-full transition-all ${estimatePasswordStrength(password).score >= 3 ? 'bg-emerald-400' : 'bg-transparent'}`}></div>
                        <div className={`h-full rounded-full transition-all ${estimatePasswordStrength(password).score >= 4 ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]' : 'bg-transparent'}`}></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* KDF selection — operator only. Guided mode silently keeps
                    the stronger Argon2id default without exposing the choice. */}
                {!isGuided && (
                <div className="pt-2 border-t border-white/5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-300 font-mono flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                      Key Derivation Hardening (KDF):
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                      WASM Accelerated
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label 
                      onClick={() => cyberAudio.playClick(900, 0.02)}
                      className={`p-2.5 rounded-xl border cursor-pointer text-[11px] font-mono flex items-center gap-2.5 transition-all ${
                        kdfChoice === 'argon2id' ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'bg-obsidian-900 border-white/10 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      <input
                        type="radio"
                        name="kdf"
                        value="argon2id"
                        checked={kdfChoice === 'argon2id'}
                        onChange={() => setKdfChoice('argon2id')}
                        className="hidden"
                      />
                      <Cpu className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <div>
                        <span className="font-bold block text-slate-200">Argon2id (64MB)</span>
                        <span className="text-[9px] text-emerald-400/80 block">OWASP Standard 2026</span>
                      </div>
                    </label>

                    <label 
                      onClick={() => cyberAudio.playClick(700, 0.02)}
                      className={`p-2.5 rounded-xl border cursor-pointer text-[11px] font-mono flex items-center gap-2.5 transition-all ${
                        kdfChoice === 'pbkdf2' ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'bg-obsidian-900 border-white/10 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      <input
                        type="radio"
                        name="kdf"
                        value="pbkdf2"
                        checked={kdfChoice === 'pbkdf2'}
                        onChange={() => setKdfChoice('pbkdf2')}
                        className="hidden"
                      />
                      <Lock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <div>
                        <span className="font-bold block text-slate-200">PBKDF2-SHA256</span>
                        <span className="text-[9px] text-slate-500 block">600,000 rounds</span>
                      </div>
                    </label>
                  </div>

                  {/* Argon2id Memory Visualizer */}
                  {kdfChoice === 'argon2id' && (
                    <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-[10px] font-mono text-emerald-300/90 flex items-center justify-between animate-fade-in">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span>Memory hardness: <strong>65,536 KiB (64MB)</strong> RAM</span>
                      </div>
                      <span className="text-slate-500 text-[9px]">ASIC/GPU Resistant</span>
                    </div>
                  )}
                </div>
                )}
              </div>
            )}
          </div>

          {/* Duress Mode — operator only. Guided mode gets neither the
              teaser hint nor the control; there's nothing to point it at. */}
          {!isGuided && usePassword && !showAdvanced && (
            <p className="pt-2 border-t border-white/5 text-[11px] text-slate-500 flex items-center gap-1.5">
              <ShieldAlert className="w-3 h-3 text-amber-400/70" />
              Need plausible deniability? Turn on <span className="text-emerald-400 font-mono">Advanced Options</span> above for duress mode.
            </p>
          )}
          {!isGuided && usePassword && showAdvanced && (
            <div className="pt-2 border-t border-white/5 space-y-2">
              <label className="flex items-center gap-2 text-xs text-amber-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useDuress}
                  onChange={(e) => setUseDuress(e.target.checked)}
                  className="rounded border-white/20 bg-obsidian-900 text-amber-500 focus:ring-amber-500/20"
                />
                <span className="flex items-center gap-1.5 font-semibold">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  Enable Duress / Decoy Password (Plausible Deniability)
                </span>
              </label>

              {useDuress && (
                <div className="p-3 bg-amber-950/20 border border-amber-500/20 rounded-xl space-y-2 text-xs">
                  <p className="text-slate-400 text-[11px]">
                    If coerced to reveal your password, entering the Duress Password will seamlessly decrypt the Decoy Secret below with zero mathematical trace of the real secret.
                  </p>
                  <input
                    type="password"
                    value={duressPassword}
                    onChange={(e) => setDuressPassword(e.target.value)}
                    placeholder="Enter secondary Duress Password…"
                    autoComplete="off"
                    data-1p-ignore
                    data-lpignore="true"
                    className="w-full glass-input px-3 py-1.5 rounded-lg text-xs font-mono text-amber-200"
                  />
                  <textarea
                    value={decoyText}
                    onChange={(e) => setDecoyText(e.target.value)}
                    placeholder="Enter harmless decoy notes or mock keys…"
                    rows={2}
                    className="w-full glass-input p-2 rounded-lg text-xs font-mono text-slate-300 resize-none"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Time-Lock Secrets Card (Server-Assisted Release Gate) */}
        {showAdvanced && (
        <div className={`glass-panel p-4 rounded-2xl border transition-all md:col-span-2 ${
          timeLockEnabled ? 'border-amber-500/40 bg-amber-950/10 shadow-lg shadow-amber-950/20' : 'border-white/10'
        } space-y-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className={`w-4 h-4 ${timeLockEnabled ? 'text-amber-400' : 'text-slate-400'}`} />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">Time-Lock Release Gate (Server-Assisted)</h3>
            </div>
            {timeLockEnabled && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                🔒 Time-Lock Active
              </span>
            )}
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={timeLockEnabled}
                onChange={(e) => setTimeLockEnabled(e.target.checked)}
                className="rounded border-white/20 bg-obsidian-900 text-amber-500 focus:ring-amber-500/20"
              />
              <span className="font-semibold text-slate-200">Time-lock this secret (Cannot be decrypted/opened before a specified release date and time)</span>
            </label>

            {timeLockEnabled && (
              <div className="pt-2 border-t border-white/5 space-y-3 animate-fadeIn">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1 font-mono">Unlock Date</label>
                    <input
                      type="date"
                      value={unlockDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setUnlockDate(e.target.value)}
                      className="w-full bg-obsidian-900 border border-white/10 text-xs text-slate-200 rounded-lg p-2 font-mono focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1 font-mono">Unlock Time</label>
                    <input
                      type="time"
                      value={unlockTime}
                      onChange={(e) => setUnlockTime(e.target.value)}
                      className="w-full bg-obsidian-900 border border-white/10 text-xs text-slate-200 rounded-lg p-2 font-mono focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1 font-mono">Timezone</label>
                    <select
                      value={unlockTimezone}
                      onChange={(e) => setUnlockTimezone(e.target.value as 'UTC' | 'local')}
                      className="w-full bg-obsidian-900 border border-white/10 text-xs text-slate-200 rounded-lg p-2 font-mono focus:border-amber-500 focus:outline-none"
                    >
                      <option value="UTC">UTC (Coordinated Universal Time)</option>
                      <option value="local">Local Time ({Intl.DateTimeFormat().resolvedOptions().timeZone || 'Browser'})</option>
                    </select>
                  </div>
                </div>

                {/* Unlock Preview & Gate Notice */}
                {(() => {
                  const preview = getUnlockPreview();
                  if (!preview) return null;
                  if (!preview.valid) {
                    return (
                      <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
                        ⚠️ {preview.message}
                      </div>
                    );
                  }
                  return (
                    <div className="p-3 bg-obsidian-950 rounded-xl border border-amber-500/20 text-xs space-y-1 font-mono">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-amber-300 font-bold flex items-center gap-1.5">
                          🔒 Unlocks: {preview.utcString}
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          Time remaining: <span className="text-amber-400 font-bold">{preview.formattedDuration}</span>
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans">
                        Server-assisted gate: The Crypton API will refuse normal retrieval and return <code className="text-amber-300 font-mono">HTTP 423 Locked</code> until this release timestamp.
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
        )}

        {!isGuided && !showAdvanced && (
          <div className="glass-panel p-4 rounded-2xl border border-white/10 md:col-span-2 flex items-center gap-2.5 text-xs text-slate-500">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            Need Quorum multi-trustee approvals, Argon2id KDF, or scheduled time-lock? Check <span className="text-emerald-400 font-mono">Cryptographic Options</span> above.
          </div>
        )}

      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 glass-panel rounded-2xl border border-white/10">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-1.5 font-mono">
            <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">⌘ + Enter</span>
            <span>to encrypt</span>
          </div>
          <span>•</span>
          <span className="text-emerald-400">
            {isGuided
              ? 'Encrypted in your browser'
              : sharingMode === 'quorum' ? `Shamir Quorum (${quorumThreshold}-of-${quorumTotalShares})` : sharingMode === 'multi' ? `Multi-Recipient (${recipients.length} Slots)` : 'Zero-Knowledge AES-GCM'}
          </span>
        </div>

        <button
          type="submit"
          disabled={isEncrypting}
          className="btn-cyber-primary flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
        >
          {isEncrypting ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              <span>{isGuided ? 'Creating your link…' : 'Encrypting in WebCrypto…'}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>
                {isGuided
                  ? 'Create Secret Link'
                  : sharingMode === 'quorum' ? 'Generate Quorum Secret & Trustee Shares' : sharingMode === 'multi' ? 'Generate Multi-Recipient Envelopes' : 'Encrypt & Create Secret Link'}
              </span>
            </>
          )}
        </button>
      </div>

    </form>
    </TerminalWindow>
    </div>
  );
};
