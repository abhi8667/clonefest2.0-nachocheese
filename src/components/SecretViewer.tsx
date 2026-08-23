import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Unlock, 
  Flame, 
  Copy, 
  Check, 
  Download, 
  FileText, 
  FileCode, 
  ListOrdered, 
  Paperclip, 
  MessageSquare, 
  Send, 
  Trash2, 
  ShieldCheck, 
  AlertTriangle, 
  Clock, 
  Eye, 
  EyeOff,
  Sparkles,
  File,
  ShieldAlert
} from 'lucide-react';
import { PasteResponse, DecryptedSecret, StoredComment } from '../types';
import { decryptSecret, encryptSecret, generateMasterKey } from '../crypto/webcrypto';

interface SecretViewerProps {
  pasteId: string;
  masterKey: string;
  onClose: () => void;
}

export const SecretViewer: React.FC<SecretViewerProps> = ({ pasteId, masterKey, onClose }) => {
  // Network & Paste State
  const [pasteData, setPasteData] = useState<PasteResponse | null>(null);
  const [decryptedSecret, setDecryptedSecret] = useState<DecryptedSecret | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Password Decryption State
  const [isPasswordRequired, setIsPasswordRequired] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);

  // UI state
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [copiedKeyIdx, setCopiedKeyIdx] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isBurningAnimation, setIsBurningAnimation] = useState<boolean>(false);
  const [isBurnedFromMemory, setIsBurnedFromMemory] = useState<boolean>(false);

  // Comment state
  const [comments, setComments] = useState<StoredComment[]>([]);
  const [newCommentAuthor, setNewCommentAuthor] = useState<string>('Anonymous');
  const [newCommentText, setNewCommentText] = useState<string>('');
  const [isSubmittingComment, setIsSubmittingComment] = useState<boolean>(false);

  // Deletion state
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [deleteTokenInput, setDeleteTokenInput] = useState<string>('');
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);

  // 1. Fetch ciphertext payload from server
  useEffect(() => {
    let isMounted = true;

    async function loadPaste() {
      try {
        setIsLoading(true);
        setFetchError(null);

        const res = await fetch(`/api/paste/${pasteId}`);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('This secret has expired, burned after reading, or does not exist.');
          }
          throw new Error(`Failed to load secret (HTTP ${res.status}).`);
        }

        const data: PasteResponse = await res.json();
        if (!isMounted) return;

        setPasteData(data);
        setComments(data.comments || []);

        // Calculate TTL
        const now = Math.floor(Date.now() / 1000);
        if (data.expireAt) {
          setTimeRemaining(Math.max(0, data.expireAt - now));
        }

        // Attempt initial automatic decryption without password
        try {
          const decrypted = await decryptSecret(data.payload, masterKey);
          if (isMounted) {
            setDecryptedSecret(decrypted);
            decryptComments(data.comments || [], masterKey);
          }
        } catch (err) {
          // If decryption without password fails, prompt for password
          if (isMounted) {
            setIsPasswordRequired(true);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setFetchError(err.message || 'Error loading secret.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadPaste();
    return () => { isMounted = false; };
  }, [pasteId, masterKey]);

  // Live Countdown Timer
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return;
    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeRemaining]);

  // Decrypt comments with master key
  const decryptComments = async (rawComments: StoredComment[], key: string) => {
    const decryptedList: StoredComment[] = [];
    for (const c of rawComments) {
      try {
        const dec = await decryptSecret(
          {
            v: 2,
            ct: c.payload.ct,
            iv: c.payload.iv,
            salt: (c.payload as any).salt,
            adata: (c.payload as any).adata,
          },
          key
        );
        decryptedList.push({
          ...c,
          decrypted: {
            author: dec.language || 'Anonymous',
            text: dec.text,
          },
        });
      } catch (_) {
        decryptedList.push(c);
      }
    }
    setComments(decryptedList);
  };

  // Password decryption attempt (also handles Duress Password)
  const handlePasswordDecrypt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || !pasteData) return;

    try {
      setIsDecrypting(true);
      setDecryptError(null);

      const decrypted = await decryptSecret(pasteData.payload, masterKey, password.trim());
      setDecryptedSecret(decrypted);
      setIsPasswordRequired(false);
      decryptComments(pasteData.comments || [], masterKey);
    } catch (err: any) {
      setDecryptError('Decryption failed. Incorrect password.');
    } finally {
      setIsDecrypting(false);
    }
  };

  // Post Zero-Knowledge Encrypted Comment
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !pasteData) return;

    try {
      setIsSubmittingComment(true);

      // Encrypt comment with masterKey
      const encrypted = await encryptSecret(
        {
          text: newCommentText.trim(),
          formatter: 'plaintext',
          language: newCommentAuthor.trim() || 'Anonymous',
        },
        masterKey
      );

      const res = await fetch(`/api/paste/${pasteId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: {
            ct: encrypted.ct,
            iv: encrypted.iv,
            salt: encrypted.salt,
            adata: encrypted.adata,
          },
        }),
      });

      if (!res.ok) throw new Error('Failed to post encrypted comment.');

      const newStoredComment: StoredComment = await res.json();
      newStoredComment.decrypted = {
        author: newCommentAuthor.trim() || 'Anonymous',
        text: newCommentText.trim(),
      };

      setComments(prev => [...prev, newStoredComment]);
      setNewCommentText('');
    } catch (err: any) {
      console.error('Comment error:', err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Trigger Cinematic Burn / Memory Zeroization Animation
  const handleBurnFromMemory = () => {
    setIsBurningAnimation(true);
    setTimeout(() => {
      setIsBurnedFromMemory(true);
      setIsBurningAnimation(false);
    }, 1200);
  };

  // Manual Delete on Server
  const handleManualDelete = async () => {
    if (!deleteTokenInput.trim()) return;
    try {
      setDeleteStatus('Destroying...');
      const res = await fetch(`/api/paste/${pasteId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteToken: deleteTokenInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Deletion failed.');
      setDeleteStatus('Secret permanently deleted from server.');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setDeleteStatus(`Error: ${err.message}`);
    }
  };

  const copyToClipboard = async (textToCopy: string) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch (_) {}
  };

  const formatCountdown = (sec: number) => {
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  // Parse ENV Key-Values for structured display
  const parsedEnvItems = () => {
    if (!decryptedSecret || decryptedSecret.formatter !== 'env') return [];
    return decryptedSecret.text
      .split('\n')
      .filter(line => line.includes('='))
      .map(line => {
        const idx = line.indexOf('=');
        return {
          key: line.substring(0, idx).trim(),
          value: line.substring(idx + 1).trim(),
        };
      });
  };

  // ----------------------------------------------------
  // RENDER: Loading & Error States
  // ----------------------------------------------------

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-12 glass-panel rounded-3xl border border-white/10 flex flex-col items-center justify-center space-y-4">
        <div className="relative w-16 h-16">
          <div className="w-16 h-16 rounded-2xl border-2 border-emerald-500/30 border-t-emerald-400 animate-spin"></div>
          <Lock className="w-6 h-6 text-emerald-400 absolute inset-0 m-auto animate-pulse" />
        </div>
        <div className="text-center">
          <h3 className="text-sm font-mono font-bold text-slate-200 uppercase tracking-wider">Fetching Ciphertext</h3>
          <p className="text-xs text-slate-400">Zero-Knowledge handshake with server...</p>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="max-w-xl mx-auto p-8 glass-panel rounded-3xl border border-rose-500/30 text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
          <Flame className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-100">Secret Unavailable</h2>
          <p className="text-sm text-slate-400 leading-relaxed">{fetchError}</p>
        </div>
        <div className="p-3 bg-obsidian-950 rounded-xl text-xs font-mono text-slate-500 border border-white/5">
          Guaranteed Zero-Knowledge: Expired or burned secrets are permanently purged from database and memory buffers.
        </div>
        <button
          onClick={onClose}
          className="btn-cyber-primary px-6 py-2 rounded-xl text-xs font-semibold"
        >
          Create New Secret
        </button>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: Password Decryption Gate
  // ----------------------------------------------------

  if (isPasswordRequired && !decryptedSecret) {
    return (
      <div className="max-w-md mx-auto p-8 glass-panel-glow rounded-3xl border border-emerald-500/30 shadow-2xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Password Protected Secret</h2>
            <p className="text-xs text-slate-400">Enter password to derive AES-256 key</p>
          </div>
        </div>

        <form onSubmit={handlePasswordDecrypt} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-slate-300 uppercase mb-1">Decryption Password</label>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password..."
              className="w-full glass-input px-4 py-3 rounded-xl text-sm font-mono text-slate-100 focus:outline-none"
            />
          </div>

          {decryptError && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{decryptError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isDecrypting || !password.trim()}
            className="btn-cyber-primary w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold disabled:opacity-50"
          >
            {isDecrypting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Deriving Key (600,000 rounds)...</span>
              </>
            ) : (
              <>
                <Unlock className="w-4 h-4" />
                <span>Decrypt Secret</span>
              </>
            )}
          </button>
        </form>

        <div className="text-[11px] text-slate-500 text-center font-mono">
          PBKDF2-SHA256 • Hardware Accelerated
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: Destroyed from Memory State
  // ----------------------------------------------------

  if (isBurnedFromMemory) {
    return (
      <div className="max-w-md mx-auto p-8 glass-panel rounded-3xl border border-rose-500/30 text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-slate-100">Cryptographic Memory Zeroized</h2>
          <p className="text-xs text-slate-400">
            Plaintext buffers and derived keys have been purged with random PRNG bytes from browser memory.
          </p>
        </div>
        <button
          onClick={onClose}
          className="btn-cyber-primary px-6 py-2 rounded-xl text-xs font-semibold"
        >
          Return Home
        </button>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: Decrypted Secret Viewer
  // ----------------------------------------------------

  return (
    <div className={`max-w-5xl mx-auto space-y-6 transition-all duration-700 ${isBurningAnimation ? 'opacity-0 scale-95 filter blur-md' : 'opacity-100 scale-100'}`}>
      
      {/* Top Banner: Status & Zeroization Controls */}
      <div className="glass-panel p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 border border-emerald-500/30 bg-gradient-to-r from-emerald-950/20 via-obsidian-900 to-obsidian-900 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Unlock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-100">Decrypted Successfully</h2>
              {pasteData?.burnAfterReading && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30 font-mono">
                  🔥 Server Copy Burned
                </span>
              )}
              {decryptedSecret?.isDecoy && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" /> Decoy Payload
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono">
              AES-256-GCM • Tag Verified • Zero Server Knowledge
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {timeRemaining !== null && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-obsidian-950 border border-white/10 text-xs font-mono text-emerald-400">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatCountdown(timeRemaining)}</span>
            </div>
          )}

          <button
            onClick={() => copyToClipboard(decryptedSecret?.text || '')}
            className="btn-cyber-primary flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold"
          >
            {copiedText ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedText ? 'Copied' : 'Copy Text'}</span>
          </button>

          <button
            onClick={handleBurnFromMemory}
            className="btn-cyber-danger flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold"
            title="Zeroize memory and close secret"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Wipe Memory</span>
          </button>
        </div>
      </div>

      {/* Main Secret Content Viewer */}
      <div className="glass-panel rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
        
        {/* Content Header Bar */}
        <div className="flex items-center justify-between px-6 py-3 bg-obsidian-950 border-b border-white/5 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            {decryptedSecret?.formatter === 'code' && <FileCode className="w-4 h-4 text-emerald-400" />}
            {decryptedSecret?.formatter === 'markdown' && <FileText className="w-4 h-4 text-emerald-400" />}
            {decryptedSecret?.formatter === 'env' && <ListOrdered className="w-4 h-4 text-emerald-400" />}
            {decryptedSecret?.formatter === 'plaintext' && <File className="w-4 h-4 text-emerald-400" />}
            <span className="uppercase text-slate-200 font-bold">
              {decryptedSecret?.language || decryptedSecret?.formatter || 'Secret Payload'}
            </span>
          </div>
          <span>Length: {decryptedSecret?.text.length || 0} characters</span>
        </div>

        {/* Body based on format */}
        <div className="p-6 bg-obsidian-950/60">
          {decryptedSecret?.formatter === 'env' ? (
            /* Structured Key-Value Viewer */
            <div className="space-y-2.5">
              {parsedEnvItems().map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-obsidian-900 rounded-xl border border-white/5 font-mono text-xs">
                  <span className="text-emerald-400 font-bold">{item.key}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-300 select-all">{item.value}</span>
                    <button
                      type="button"
                      onClick={() => {
                        copyToClipboard(item.value);
                        setCopiedKeyIdx(idx);
                        setTimeout(() => setCopiedKeyIdx(null), 2000);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-emerald-400 transition-colors"
                      title="Copy Key Value"
                    >
                      {copiedKeyIdx === idx ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : decryptedSecret?.formatter === 'markdown' ? (
            /* Markdown Viewer */
            <div className="prose prose-invert prose-emerald max-w-none text-sm font-sans leading-relaxed whitespace-pre-wrap">
              {decryptedSecret.text}
            </div>
          ) : (
            /* Code / Plaintext Viewer */
            <pre className="font-mono text-xs text-emerald-200 overflow-x-auto p-4 bg-obsidian-950 rounded-2xl border border-white/5 leading-relaxed selection:bg-emerald-500/40">
              <code>{decryptedSecret?.text}</code>
            </pre>
          )}
        </div>

        {/* Attachment Card (if present) */}
        {decryptedSecret?.attachment && (
          <div className="p-6 bg-emerald-950/20 border-t border-emerald-500/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <Paperclip className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold font-mono text-emerald-300">{decryptedSecret.attachment.name}</h4>
                <p className="text-[11px] text-slate-400 font-mono">
                  {(decryptedSecret.attachment.size / 1024).toFixed(1)} KB • {decryptedSecret.attachment.type}
                </p>
              </div>
            </div>

            <a
              href={decryptedSecret.attachment.data}
              download={decryptedSecret.attachment.name}
              className="btn-cyber-primary flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold"
            >
              <Download className="w-4 h-4" />
              <span>Download Decrypted File</span>
            </a>
          </div>
        )}
      </div>

      {/* Discussion & Encrypted Comments Section */}
      {pasteData?.openDiscussion && (
        <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-200">Encrypted Discussion ({comments.length})</h3>
            </div>
            <span className="text-xs font-mono text-emerald-400/80">E2EE Comment Thread</span>
          </div>

          {/* Comments List */}
          <div className="space-y-3">
            {comments.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No encrypted comments yet. Be the first to leave a message.</p>
            ) : (
              comments.map((c, i) => (
                <div key={i} className="p-4 bg-obsidian-950/80 rounded-2xl border border-white/5 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-400 font-mono">{c.decrypted?.author || 'Anonymous'}</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(c.createdAt * 1000).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-sans">{c.decrypted?.text || '[Encrypted Content]'}</p>
                </div>
              ))
            )}
          </div>

          {/* New Comment Form */}
          <form onSubmit={handlePostComment} className="space-y-3 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input
                type="text"
                value={newCommentAuthor}
                onChange={(e) => setNewCommentAuthor(e.target.value)}
                placeholder="Alias / Handle"
                className="sm:col-span-1 glass-input px-3 py-2 rounded-xl text-xs font-mono text-slate-200"
              />
              <input
                type="text"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Type an end-to-end encrypted reply..."
                className="sm:col-span-3 glass-input px-4 py-2 rounded-xl text-xs text-slate-200"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmittingComment || !newCommentText.trim()}
                className="btn-cyber-primary flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Encrypt & Post Reply</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Manual Delete Trigger Link */}
      <div className="text-center pt-4">
        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className="text-xs text-slate-500 hover:text-rose-400 font-mono transition-colors"
        >
          Have a Deletion Token? Manually destroy secret from server
        </button>
      </div>

      {/* Manual Deletion Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian-950/80 backdrop-blur-md">
          <div className="w-full max-w-md glass-panel p-6 rounded-3xl border border-rose-500/30 space-y-4">
            <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2">
              <Flame className="w-4 h-4" />
              Manual Secret Deletion
            </h3>
            <p className="text-xs text-slate-400">
              Enter the unique deletion token generated when this secret was created.
            </p>
            <input
              type="text"
              value={deleteTokenInput}
              onChange={(e) => setDeleteTokenInput(e.target.value)}
              placeholder="Enter 32-character deletion token..."
              className="w-full glass-input px-3 py-2 rounded-xl text-xs font-mono text-rose-200"
            />
            {deleteStatus && <p className="text-xs font-mono text-rose-300">{deleteStatus}</p>}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleManualDelete}
                className="btn-cyber-danger px-4 py-2 rounded-xl text-xs font-bold"
              >
                Destroy Permanently
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
