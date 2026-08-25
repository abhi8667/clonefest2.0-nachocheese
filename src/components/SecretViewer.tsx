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
  ShieldAlert,
  Users,
  KeyRound,
  Share2,
  Cpu,
  Fingerprint,
  Plus
} from 'lucide-react';
import { PasteResponse, DecryptedSecret, StoredComment, RecipientEnvelopeSlot } from '../types';
import { TerminalWindow } from './TerminalWindow';
import { 
  decryptSecret, 
  encryptSecret, 
  generateMasterKey,
  unwrapRecipientEnvelope,
  decryptMultiRecipientSecret,
  combineQuorumSharesToCek
} from '../crypto/webcrypto';
import { cyberAudio } from '../utils/cyberAudio';

interface SecretViewerProps {
  pasteId: string;
  masterKey: string;
  slotId?: string;
  onClose: () => void;
}

export const SecretViewer: React.FC<SecretViewerProps> = ({ pasteId, masterKey, slotId, onClose }) => {
  // Network & Paste State
  const [pasteData, setPasteData] = useState<PasteResponse | null>(null);
  const [decryptedSecret, setDecryptedSecret] = useState<DecryptedSecret | null>(null);
  const [activeSlotInfo, setActiveSlotInfo] = useState<RecipientEnvelopeSlot | null>(null);
  const [effectiveCEK, setEffectiveCEK] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Quorum (Shamir M-of-N) Unlock State
  const [isQuorum, setIsQuorum] = useState<boolean>(false);
  const [quorumThreshold, setQuorumThreshold] = useState<number>(2);
  const [quorumTotalShares, setQuorumTotalShares] = useState<number>(3);
  const [enteredShares, setEnteredShares] = useState<string[]>([]);
  const [newShareInput, setNewShareInput] = useState<string>('');
  const [quorumError, setQuorumError] = useState<string | null>(null);
  const [isCombiningShares, setIsCombiningShares] = useState<boolean>(false);

  // Password Decryption State
  const [isPasswordRequired, setIsPasswordRequired] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);

  // Time-Lock State (Server-Assisted Release Gate)
  const [isTimeLocked, setIsTimeLocked] = useState<boolean>(false);
  const [timeLockUnlockAt, setTimeLockUnlockAt] = useState<string | null>(null);
  const [timeLockCountdown, setTimeLockCountdown] = useState<number | null>(null);
  const [isCheckingUnlock, setIsCheckingUnlock] = useState<boolean>(false);

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
  const loadPaste = async (showCheckingSpinner = false) => {
    try {
      if (showCheckingSpinner) {
        setIsCheckingUnlock(true);
      } else {
        setIsLoading(true);
      }
      setFetchError(null);

      const fetchUrl = slotId 
        ? `/api/paste/${pasteId}?slot=${encodeURIComponent(slotId)}`
        : `/api/paste/${pasteId}`;

      const res = await fetch(fetchUrl);
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 423 || data.error === 'TIME_LOCKED') {
          setIsTimeLocked(true);
          setTimeLockUnlockAt(data.unlockAt);
          if (data.unlockAt) {
            const diffSec = Math.floor((new Date(data.unlockAt).getTime() - Date.now()) / 1000);
            setTimeLockCountdown(Math.max(0, diffSec));
          }
          return;
        }
        if (res.status === 404) {
          throw new Error(data.error || 'This secret has expired, was revoked, or does not exist.');
        }
        if (res.status === 410) {
          throw new Error(data.error || 'This recipient link was already burned after its first read.');
        }
        throw new Error(data.error || `Failed to load secret (HTTP ${res.status}).`);
      }

      // If we received a valid 200 payload, secret is unlocked
      setIsTimeLocked(false);
      setTimeLockUnlockAt(null);
      setPasteData(data);
      setComments(data.comments || []);

      // Calculate TTL
      const now = Math.floor(Date.now() / 1000);
      if (data.expireAt) {
        setTimeRemaining(Math.max(0, data.expireAt - now));
      }

      // Check if Quorum threshold secret
      if (data.payload?.quorum) {
        setIsQuorum(true);
        const thresh = data.payload.quorum.threshold || 2;
        const total = data.payload.quorum.totalShares || 3;
        setQuorumThreshold(thresh);
        setQuorumTotalShares(total);

        const initialShares: string[] = [];
        if (masterKey && masterKey.trim()) {
          initialShares.push(masterKey.trim());
          setEnteredShares(initialShares);
        }

        if (initialShares.length >= thresh) {
          try {
            const recoveredKey = await combineQuorumSharesToCek(initialShares);
            setEffectiveCEK(recoveredKey);
            const decrypted = await decryptSecret(data.payload, recoveredKey);
            setDecryptedSecret(decrypted);
            cyberAudio.playDecryptSuccess();
            decryptComments(data.comments || [], recoveredKey);
          } catch (err) {
            setIsPasswordRequired(true);
          }
        }
        return;
      }

      // Determine if multi-recipient envelope decryption is needed
      if (data.isMultiRecipient) {
        const envelope = data.activeSlot || data.envelopes?.find((e: RecipientEnvelopeSlot) => e.slotId === slotId);
        if (!envelope) {
          throw new Error('Could not identify a valid recipient envelope slot for this link.');
        }
        setActiveSlotInfo(envelope);

        try {
          // Attempt automatic unwrap & decrypt without password
          const unwrappedKey = await unwrapRecipientEnvelope(envelope, masterKey);
          const decrypted = await decryptSecret(data.payload, unwrappedKey);
          setEffectiveCEK(unwrappedKey);
          setDecryptedSecret(decrypted);
          cyberAudio.playDecryptSuccess();
          decryptComments(data.comments || [], unwrappedKey);
        } catch (err) {
          // Password required for this slot or master payload
          setIsPasswordRequired(true);
        }
      } else {
        // Standard single-link paste
        setEffectiveCEK(masterKey);
        try {
          const decrypted = await decryptSecret(data.payload, masterKey);
          setEffectiveCEK(masterKey);
          setDecryptedSecret(decrypted);
          cyberAudio.playDecryptSuccess();
          decryptComments(data.comments || [], masterKey);
        } catch (err) {
          setIsPasswordRequired(true);
        }
      }
    } catch (err: any) {
      setFetchError(err.message || 'Error loading secret.');
    } finally {
      setIsLoading(false);
      setIsCheckingUnlock(false);
    }
  };

  useEffect(() => {
    loadPaste();
  }, [pasteId, masterKey, slotId]);

  // Live Time-Lock Countdown Timer
  useEffect(() => {
    if (timeLockCountdown === null) return;
    const interval = setInterval(() => {
      setTimeLockCountdown(prev => {
        if (prev === null || prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLockCountdown !== null]);

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

  // Decrypt comments with active key
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

  // Quorum Share Helpers
  const handleAddQuorumShare = (input: string) => {
    let clean = input.trim();
    if (clean.includes('k=')) {
      try {
        const hash = clean.includes('#') ? clean.split('#')[1] : clean.split('?')[1] || clean;
        const params = new URLSearchParams(hash);
        const k = params.get('k');
        if (k) clean = k;
      } catch (_) {}
    }
    if (!clean) return;
    if (enteredShares.includes(clean)) {
      setQuorumError('This share has already been entered.');
      return;
    }
    const updated = [...enteredShares, clean];
    setEnteredShares(updated);
    setNewShareInput('');
    setQuorumError(null);
  };

  const handleRemoveQuorumShare = (idx: number) => {
    setEnteredShares(enteredShares.filter((_, i) => i !== idx));
  };

  const handleQuorumUnlock = async () => {
    try {
      setIsCombiningShares(true);
      setQuorumError(null);
      if (enteredShares.length < quorumThreshold) {
        throw new Error(`Need at least ${quorumThreshold} shares to reconstruct key (${enteredShares.length} entered).`);
      }
      const recoveredKey = await combineQuorumSharesToCek(enteredShares);
      setEffectiveCEK(recoveredKey);
      const decrypted = await decryptSecret(pasteData!.payload, recoveredKey, password.trim() || undefined);
      setDecryptedSecret(decrypted);
      cyberAudio.playDecryptSuccess();
      setIsPasswordRequired(false);
      decryptComments(pasteData!.comments || [], recoveredKey);
    } catch (err: any) {
      console.error('Quorum unlock error:', err);
      if (err.message && err.message.includes('Password')) {
        setIsPasswordRequired(true);
      } else {
        setQuorumError(err.message || 'Failed to reconstruct secret from entered shares.');
      }
    } finally {
      setIsCombiningShares(false);
    }
  };

  // Password decryption attempt (also handles Duress Password & Envelope password)
  const handlePasswordDecrypt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || !pasteData) return;

    try {
      setIsDecrypting(true);
      setDecryptError(null);

      if (isQuorum && effectiveCEK) {
        const decrypted = await decryptSecret(pasteData.payload, effectiveCEK, password.trim());
        setDecryptedSecret(decrypted);
        cyberAudio.playDecryptSuccess();
        setIsPasswordRequired(false);
        decryptComments(pasteData.comments || [], effectiveCEK);
      } else if (pasteData.isMultiRecipient && activeSlotInfo) {
        const unwrappedKey = await unwrapRecipientEnvelope(activeSlotInfo, masterKey, password.trim());
        const decrypted = await decryptSecret(pasteData.payload, unwrappedKey, password.trim());
        setEffectiveCEK(unwrappedKey);
        setDecryptedSecret(decrypted);
        cyberAudio.playDecryptSuccess();
        setIsPasswordRequired(false);
        decryptComments(pasteData.comments || [], unwrappedKey);
      } else {
        const decrypted = await decryptSecret(pasteData.payload, masterKey, password.trim());
        setEffectiveCEK(masterKey);
        setDecryptedSecret(decrypted);
        cyberAudio.playDecryptSuccess();
        setIsPasswordRequired(false);
        decryptComments(pasteData.comments || [], masterKey);
      }
    } catch (err: any) {
      setDecryptError('Decryption failed. Incorrect passphrase or duress key mismatch.');
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

      // Encrypt comment with effective Content Encryption Key
      const keyToUse = effectiveCEK || masterKey;
      const encrypted = await encryptSecret(
        {
          text: newCommentText.trim(),
          formatter: 'plaintext',
          language: newCommentAuthor.trim() || 'Anonymous',
        },
        keyToUse
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
      cyberAudio.playClick(1400, 0.02);
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

  const formatTimeLockCountdown = (sec: number) => {
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (d > 0) return `${d} days ${h} hours ${m} minutes ${s} seconds`;
    if (h > 0) return `${h} hours ${m} minutes ${s} seconds`;
    return `${m} minutes ${s} seconds`;
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
      <div className="max-w-4xl mx-auto">
      <TerminalWindow path="anonymous@cipherdrop — fetching">
      <div className="p-12 flex flex-col items-center justify-center space-y-4">
        <div className="relative w-16 h-16">
          <div className="w-16 h-16 rounded-2xl border-2 border-emerald-500/30 border-t-emerald-400 animate-spin"></div>
          <Lock className="w-6 h-6 text-emerald-400 absolute inset-0 m-auto animate-pulse" />
        </div>
        <div className="text-center">
          <h3 className="text-sm font-mono font-bold text-slate-200 uppercase tracking-wider">Fetching Ciphertext</h3>
          <p className="text-xs text-slate-400">Zero-Knowledge handshake with server…</p>
        </div>
      </div>
      </TerminalWindow>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="max-w-xl mx-auto">
      <TerminalWindow path="anonymous@cipherdrop — unavailable" accent="rose">
      <div className="p-8 text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
          <Flame className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="font-mono text-xl font-bold text-slate-100">Secret Unavailable</h2>
          <p className="text-sm text-slate-400 leading-relaxed">{fetchError}</p>
        </div>
        <div className="p-3 bg-obsidian-950 rounded-xl text-xs font-mono text-slate-500 border border-white/5">
          Guaranteed Zero-Knowledge: Expired, revoked, or burned secrets are permanently purged from database and memory buffers.
        </div>
        <button
          onClick={onClose}
          className="btn-cyber-primary px-6 py-2 rounded-xl text-xs font-semibold"
        >
          Create New Secret
        </button>
      </div>
      </TerminalWindow>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: Quorum Unlock Portal (Shamir M-of-N)
  // ----------------------------------------------------

  if (isQuorum && !decryptedSecret && !isPasswordRequired) {
    const isThresholdReached = enteredShares.length >= quorumThreshold;
    return (
      <div className="max-w-2xl mx-auto animate-fadeIn">
      <TerminalWindow path="anonymous@cipherdrop — quorum-unlock" glow className="shadow-2xl">
      <div className="p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Share2 className="w-8 h-8" />
          </div>
          <div>
            <h2 className="font-mono text-xl font-bold text-slate-100 flex items-center gap-2">
              Quorum Threshold Unlock
              <span className="px-2 py-0.5 rounded text-xs font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {enteredShares.length} / {quorumThreshold} Required
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              This secret is split across <strong>{quorumTotalShares}</strong> polynomial shares. Enter any <strong>{quorumThreshold}</strong> trustee shares to mathematically reconstruct the master key.
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-mono text-slate-400">
            <span>Trustee Approvals Progress</span>
            <span className="text-emerald-400 font-bold">
              {Math.min(100, Math.round((enteredShares.length / quorumThreshold) * 100))}%
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-obsidian-950 border border-white/10 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
              style={{ width: `${Math.min(100, (enteredShares.length / quorumThreshold) * 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Entered Shares List */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
            Collected Trustee Shares ({enteredShares.length})
          </span>

          {enteredShares.length === 0 ? (
            <div className="p-4 bg-obsidian-950 rounded-xl border border-dashed border-white/10 text-center text-xs text-slate-500 font-mono">
              No trustee shares entered yet. Paste share keys or links below.
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {enteredShares.map((share, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 p-2.5 bg-obsidian-950 rounded-xl border border-white/10 text-xs font-mono">
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold flex items-center justify-center border border-emerald-500/20 flex-shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-emerald-300 truncate">{share}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveQuorumShare(idx)}
                    className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Share Entry Input */}
        <div className="space-y-2">
          <label className="block text-xs font-mono text-slate-300">
            Paste Next Trustee Share Key or Link:
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newShareInput}
              onChange={(e) => setNewShareInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddQuorumShare(newShareInput);
                }
              }}
              placeholder="Paste trustee URL or share key (e.g. qs_1_...)"
              className="w-full glass-input px-3 py-2 rounded-xl text-xs font-mono text-slate-100 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => handleAddQuorumShare(newShareInput)}
              className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-1 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Share
            </button>
          </div>
        </div>

        {quorumError && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{quorumError}</span>
          </div>
        )}

        {/* Action Button */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 bg-obsidian-900 border border-white/10"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!isThresholdReached || isCombiningShares}
            onClick={() => handleQuorumUnlock()}
            className="btn-cyber-primary flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50"
          >
            {isCombiningShares ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Combining Shamir Polynomials…</span>
              </>
            ) : (
              <>
                <Unlock className="w-4 h-4" />
                <span>
                  {isThresholdReached 
                    ? 'Reconstruct Key & Decrypt Secret' 
                    : `Need ${quorumThreshold - enteredShares.length} More Share${quorumThreshold - enteredShares.length === 1 ? '' : 's'}`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
      </TerminalWindow>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: Time-Locked Secret Gate Screen
  // ----------------------------------------------------

  if (isTimeLocked && !decryptedSecret) {
    const isUnlockedNow = timeLockCountdown !== null && timeLockCountdown <= 0;
    return (
      <div className="max-w-xl mx-auto animate-fadeIn">
      <TerminalWindow path="anonymous@cipherdrop — time-locked" accent="amber" glow className="shadow-2xl">
      <div className="p-8 text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
          {isUnlockedNow ? <Unlock className="w-8 h-8 text-emerald-400 animate-bounce" /> : <Lock className="w-8 h-8 text-amber-400" />}
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-100 flex items-center justify-center gap-2">
            {isUnlockedNow ? '🔓 Secret Ready for Decryption' : '🔒 Secret Locked'}
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            {isUnlockedNow
              ? 'The configured release time has arrived! You can now request the encrypted ciphertext from the server and decrypt it client-side.'
              : 'This secret is protected by a server-assisted time lock and cannot be opened yet.'}
          </p>
        </div>

        {timeLockUnlockAt && (
          <div className="p-4 bg-obsidian-950 rounded-2xl border border-white/10 space-y-3 text-xs font-mono">
            <div className="space-y-1">
              <span className="text-slate-500 block text-[10px] uppercase">Authoritative Unlock Time (UTC)</span>
              <span className="text-amber-300 font-bold text-sm">{new Date(timeLockUnlockAt).toUTCString()}</span>
            </div>

            <div className="space-y-1 pt-1 border-t border-white/5">
              <span className="text-slate-500 block text-[10px] uppercase">Your Local Time</span>
              <span className="text-slate-200">{new Date(timeLockUnlockAt).toLocaleString()}</span>
            </div>

            {!isUnlockedNow && timeLockCountdown !== null && (
              <div className="p-3 bg-amber-950/30 rounded-xl border border-amber-500/20 space-y-1">
                <span className="text-amber-400 block text-[10px] font-bold uppercase">Time Remaining</span>
                <span className="text-amber-200 font-bold text-base tracking-wider block">
                  {formatTimeLockCountdown(timeLockCountdown)}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="p-3 bg-obsidian-950 rounded-xl text-xs font-mono text-slate-400 border border-white/5 text-left space-y-1">
          <p className="text-slate-300 font-semibold flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Zero-Knowledge Server-Side Release Gate
          </p>
          <p className="text-[11px] text-slate-500">
            The server strictly gates release using its authoritative clock. Bypassing or modifying client-side clocks will still result in HTTP 423 Locked.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 bg-obsidian-900 border border-white/10"
          >
            Back
          </button>

          <button
            type="button"
            disabled={isCheckingUnlock}
            onClick={() => loadPaste(true)}
            className="btn-cyber-primary flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50"
          >
            {isCheckingUnlock ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Verifying Server Clock...</span>
              </>
            ) : isUnlockedNow ? (
              <>
                <Unlock className="w-4 h-4" />
                <span>Decrypt Secret Now</span>
              </>
            ) : (
              <>
                <Clock className="w-4 h-4" />
                <span>Check Unlock Status</span>
              </>
            )}
          </button>
        </div>
      </div>
      </TerminalWindow>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: Password Decryption Gate
  // ----------------------------------------------------

  if (isPasswordRequired && !decryptedSecret) {
    const isArgon2 = pasteData?.payload?.kdf === 'argon2id';
    return (
      <div className="max-w-md mx-auto">
      <TerminalWindow path="anonymous@cipherdrop — locked" glow>
      <div className="p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-mono text-lg font-bold text-slate-100">Passphrase Protected Secret</h2>
            <p className="text-xs text-slate-400">
              {activeSlotInfo ? `Enter passphrase for recipient [${activeSlotInfo.label}]` : 'Enter passphrase to derive AES-256 key'}
            </p>
          </div>
        </div>

        <form onSubmit={handlePasswordDecrypt} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-slate-300 uppercase mb-1">Decryption Passphrase</label>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter passphrase…"
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
                <span>{isArgon2 ? 'Deriving Argon2id (64MB WASM)...' : 'Deriving PBKDF2 (600k rounds)...'}</span>
              </>
            ) : (
              <>
                <Unlock className="w-4 h-4" />
                <span>Decrypt Secret</span>
              </>
            )}
          </button>
        </form>

        <div className="text-[11px] text-slate-500 text-center font-mono flex items-center justify-center gap-1.5">
          {isArgon2 ? (
            <>
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-semibold">Argon2id WASM (64MB Memory-Hard)</span>
            </>
          ) : (
            <span>PBKDF2-SHA256 • Hardware Accelerated</span>
          )}
        </div>
      </div>
      </TerminalWindow>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: Destroyed from Memory State
  // ----------------------------------------------------

  if (isBurnedFromMemory) {
    return (
      <div className="max-w-md mx-auto">
      <TerminalWindow path="anonymous@cipherdrop — zeroized" accent="rose">
      <div className="p-8 text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="font-mono text-lg font-bold text-slate-100">Cryptographic Memory Zeroized</h2>
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
      </TerminalWindow>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: Decrypted Secret Viewer
  // ----------------------------------------------------

  return (
    <div className={`max-w-5xl mx-auto space-y-6 transition-all duration-700 ${isBurningAnimation ? 'opacity-0 scale-95 filter blur-md' : 'opacity-100 scale-100'}`}>

      {/* Top Banner: Status & Zeroization Controls */}
      <TerminalWindow path="anonymous@cipherdrop — decrypted" glow className="shadow-xl">
      <div className="p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Unlock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-mono font-bold text-slate-100">Decrypted Successfully</h2>
              
              {isQuorum && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono flex items-center gap-1">
                  <Share2 className="w-3 h-3 text-emerald-400" />
                  Quorum Reconstructed ({quorumThreshold}/{quorumTotalShares})
                </span>
              )}

              {activeSlotInfo && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono flex items-center gap-1">
                  <Users className="w-3 h-3 text-emerald-400" />
                  Slot: {activeSlotInfo.label}
                </span>
              )}

              {pasteData?.payload?.kdf === 'argon2id' && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-teal-500/20 text-teal-300 border border-teal-500/30 font-mono flex items-center gap-1">
                  <Cpu className="w-3 h-3 text-teal-400" />
                  Argon2id (64MB)
                </span>
              )}

              {activeSlotInfo?.burnOnRead && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30 font-mono flex items-center gap-1">
                  <Flame className="w-3 h-3" /> Slot Burned on First Read
                </span>
              )}

              {!activeSlotInfo && !isQuorum && pasteData?.burnAfterReading && (
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
              {isQuorum 
                ? 'Shamir Polynomial Shares Combined • AES-256-GCM Tag Verified'
                : activeSlotInfo 
                ? 'Envelope Key Unwrapped • AES-256-GCM Payload Decrypted' 
                : 'AES-256-GCM • Tag Verified • Zero Server Knowledge'}
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
      </TerminalWindow>

      {/* Main Secret Content Viewer */}
      <TerminalWindow
        path={`anonymous@cipherdrop — ${decryptedSecret?.formatter || 'view'}`}
        glow
        className="shadow-2xl"
      >

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
      </TerminalWindow>

      {/* Discussion & Encrypted Comments Section */}
      {pasteData?.openDiscussion && (
        <TerminalWindow path="anonymous@cipherdrop — discussion" className="shadow-xl">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <h3 className="font-mono text-sm font-bold text-slate-200">Encrypted Discussion ({comments.length})</h3>
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
                placeholder="Type an end-to-end encrypted reply…"
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
        </TerminalWindow>
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
          <div className="w-full max-w-md">
        <TerminalWindow path="anonymous@cipherdrop — delete" accent="rose">
        <div className="p-6 space-y-4">
            <h3 className="font-mono text-sm font-bold text-rose-400 flex items-center gap-2">
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
              placeholder="Enter 32-character deletion token…"
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
        </TerminalWindow>
        </div>
        </div>
      )}

    </div>
  );
};
