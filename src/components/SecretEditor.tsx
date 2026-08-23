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
  UserCheck
} from 'lucide-react';
import { SecretFormatter, FileAttachment, DecryptedSecret, CreatedSecretResult } from '../types';
import { generateMasterKey, encryptSecret, encryptMultiRecipientSecret } from '../crypto/webcrypto';

interface SecretEditorProps {
  onSecretCreated: (result: CreatedSecretResult) => void;
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

export const SecretEditor: React.FC<SecretEditorProps> = ({ onSecretCreated }) => {
  // Sharing Mode: Standard (Single Key) vs Multi-Recipient Envelopes
  const [sharingMode, setSharingMode] = useState<'standard' | 'multi'>('standard');

  // Multi-Recipient Slots State
  const [recipients, setRecipients] = useState<SlotEditorItem[]>([
    { id: '1', label: 'Alice', burnOnRead: true, password: '' },
    { id: '2', label: 'Bob', burnOnRead: true, password: '' },
  ]);

  // Mode & Content State
  const [formatter, setFormatter] = useState<SecretFormatter>('code');
  const [language, setLanguage] = useState<string>('javascript');
  const [text, setText] = useState<string>('');
  
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

  // Password Protection & Duress Decoy Mode
  const [usePassword, setUsePassword] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
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
    maxViews, openDiscussion, usePassword, password, useDuress, duressPassword, decoyText,
    timeLockEnabled, unlockDate, unlockTime, unlockTimezone
  ]);

  // Handle File Drag & Drop
  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const processFile = (file: File) => {
    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage('File size exceeds maximum limit of 15MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        data: reader.result as string,
      });
      setErrorMessage(null);
    };
    reader.readAsDataURL(file);
  };

  // Calculate Expiry Seconds
  const getExpireSeconds = (opt: string): number => {
    switch (opt) {
      case 'burn': return 86400; // will also have burn flag set
      case '5min': return 5 * 60;
      case '15min': return 15 * 60;
      case '1hour': return 60 * 60;
      case '1day': return 24 * 60 * 60;
      case '7days': return 7 * 24 * 60 * 60;
      case '30days': return 30 * 24 * 60 * 60;
      case 'never': return 0;
      default: return 86400;
    }
  };

  // Add a new recipient slot
  const handleAddRecipient = () => {
    const nextIdx = recipients.length + 1;
    setRecipients([
      ...recipients,
      { id: String(Date.now()), label: `Recipient ${nextIdx}`, burnOnRead: true, password: '' },
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

      if (sharingMode === 'multi') {
        // --- MULTI-RECIPIENT ENVELOPE ENCRYPTION ---
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
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* Top Banner / Security Badge & Sharing Strategy */}
      <div className="glass-panel p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 border border-emerald-500/20 bg-gradient-to-r from-emerald-950/20 via-obsidian-900 to-obsidian-900">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              Zero-Knowledge End-to-End Encryption
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
            </h2>
            <p className="text-xs text-slate-400">
              Payload encrypted client-side with <span className="font-mono text-emerald-300">AES-256-GCM</span>. The server never sees raw secrets.
            </p>
          </div>
        </div>

        {/* Sharing Mode Toggle */}
        <div className="flex items-center gap-1 bg-obsidian-950 p-1 rounded-xl border border-white/10">
          <button
            type="button"
            onClick={() => setSharingMode('standard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              sharingMode === 'standard' ? 'bg-emerald-500 text-obsidian-950 font-bold shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            Standard Link
          </button>
          <button
            type="button"
            onClick={() => setSharingMode('multi')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              sharingMode === 'multi' ? 'bg-emerald-500 text-obsidian-950 font-bold shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Multi-Recipient Envelopes
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
              sharingMode === 'multi' ? 'bg-obsidian-950 text-emerald-400' : 'bg-white/10 text-slate-300'
            }`}>
              {recipients.length}
            </span>
          </button>
        </div>
      </div>

      {/* Multi-Recipient Slots Configuration Drawer */}
      {sharingMode === 'multi' && (
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
                      className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors"
                      title="Remove Recipient Slot"
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
                      placeholder="Optional slot passphrase..."
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
          
          {/* Formatter Tabs */}
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

          <div className="flex items-center gap-3">
            {formatter === 'code' && (
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
            {formatter === 'markdown' && (
              <span className="text-xs text-slate-400 font-mono">Live preview & Markdown</span>
            )}
            {formatter === 'env' && (
              <span className="text-xs text-slate-400 font-mono">Key-Value Secret Credentials</span>
            )}
            {formatter === 'plaintext' && (
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
                formatter === 'code'
                  ? '// Paste your sensitive code, private keys (PEM), or server configuration here...'
                  : 'Paste confidential message, passwords, or sensitive notes here...'
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
                placeholder="# Confidential Report&#10;&#10;Enter markdown text here...&#10;- Item 1&#10;- Item 2"
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
                      className="w-full glass-input px-3 py-2 pr-9 rounded-lg text-xs font-mono text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const updated = [...envEntries];
                        updated[idx].masked = !updated[idx].masked;
                        setEnvEntries(updated);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
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
              className="text-slate-400 hover:text-rose-400 transition-colors"
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
          <span>💡 Drag & drop any binary file (PDF, image, zip) here to encrypt client-side</span>
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

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Time to Live (TTL)</label>
              <select
                value={expireOption}
                onChange={(e) => setExpireOption(e.target.value)}
                className="w-full bg-obsidian-900 border border-white/10 text-xs text-slate-200 rounded-lg p-2 font-mono focus:border-emerald-500 focus:outline-none"
              >
                <option value="burn">🔥 Burn after 1 view</option>
                <option value="5min">5 Minutes</option>
                <option value="15min">15 Minutes</option>
                <option value="1hour">1 Hour</option>
                <option value="1day">1 Day (Default)</option>
                <option value="7days">7 Days</option>
                <option value="30days">30 Days</option>
                <option value="never">Never (Persistent)</option>
              </select>
            </div>

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
          </div>

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
        </div>

        {/* Password & Coercion Resistance Card */}
        <div className="glass-panel p-4 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">Password & Duress Decoy</h3>
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
              <span>Require Decryption Password (PBKDF2 600k)</span>
            </label>

            {usePassword && (
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter strong primary password..."
                className="w-full glass-input px-3 py-2 rounded-lg text-xs font-mono text-slate-100"
              />
            )}
          </div>

          {/* Duress Mode Accordion */}
          {usePassword && (
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
                    placeholder="Enter secondary Duress Password..."
                    className="w-full glass-input px-3 py-1.5 rounded-lg text-xs font-mono text-amber-200"
                  />
                  <textarea
                    value={decoyText}
                    onChange={(e) => setDecoyText(e.target.value)}
                    placeholder="Enter harmless decoy notes or mock keys..."
                    rows={2}
                    className="w-full glass-input p-2 rounded-lg text-xs font-mono text-slate-300 resize-none"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Time-Lock Secrets Card (Server-Assisted Release Gate) */}
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
                        Server-assisted gate: The CipherDrop API will refuse normal retrieval and return <code className="text-amber-300 font-mono">HTTP 423 Locked</code> until this release timestamp.
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

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
          <span className="text-emerald-400">Client-Side Key Generation</span>
        </div>

        <button
          type="button"
          disabled={isEncrypting}
          onClick={handleCreateSecret}
          className="btn-cyber-primary flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
        >
          {isEncrypting ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              <span>Encrypting in WebCrypto...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Encrypt & Create Secret Link</span>
            </>
          )}
        </button>
      </div>

    </div>
  );
};
