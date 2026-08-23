import React, { useState, useEffect } from 'react';
import { 
  Inbox, 
  Send, 
  KeyRound, 
  ShieldCheck, 
  Copy, 
  Check, 
  Lock, 
  Unlock, 
  RefreshCw, 
  Paperclip, 
  Sparkles, 
  AlertCircle,
  FileText,
  Clock
} from 'lucide-react';
import { 
  generateAsymmetricDropKeys, 
  encryptInboundDrop, 
  decryptInboundDrop 
} from '../crypto/webcrypto';
import { InboundDrop, DecryptedSecret } from '../types';
import { FeatureHighlights } from './FeatureHighlights';
import { TerminalWindow } from './TerminalWindow';

interface RequestSecretDropProps {
  initialDropId?: string;
  initialPublicKey?: string;
}

export const RequestSecretDrop: React.FC<RequestSecretDropProps> = ({ 
  initialDropId, 
  initialPublicKey 
}) => {
  // Mode: If initialDropId is passed, we are in "Submitter Mode"; otherwise "Requester Mode"
  const isSubmitter = Boolean(initialDropId && initialPublicKey);

  // Requester State
  const [prompt, setPrompt] = useState<string>('Please securely provide the production API keys and database credentials.');
  const [createdDrop, setCreatedDrop] = useState<{ id: string; dropUrl: string; privateKey: string } | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [receivedSecret, setReceivedSecret] = useState<DecryptedSecret | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Submitter State
  const [submitterText, setSubmitterText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [dropInfo, setDropInfo] = useState<InboundDrop | null>(null);

  // If submitter, fetch drop info
  useEffect(() => {
    if (isSubmitter && initialDropId) {
      fetch(`/api/request-drop/${initialDropId}`)
        .then(res => res.json())
        .then(data => setDropInfo(data))
        .catch(err => setSubmitError('Failed to load drop request.'));
    }
  }, [isSubmitter, initialDropId]);

  // Requester Polling for Completed Drop
  useEffect(() => {
    let interval: any;
    if (createdDrop && !receivedSecret) {
      setIsPolling(true);
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/request-drop/${createdDrop.id}`);
          if (!res.ok) return;
          const drop: InboundDrop = await res.json();
          if (drop.status === 'completed' && drop.encryptedPayload) {
            clearInterval(interval);
            setIsPolling(false);
            // Decrypt with requester private key
            const decrypted = await decryptInboundDrop(drop.encryptedPayload, createdDrop.privateKey);
            setReceivedSecret(decrypted);
          }
        } catch (_) {}
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [createdDrop, receivedSecret]);

  // Requester: Create Inbound Drop Link
  const handleCreateDropLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    try {
      setIsGenerating(true);
      // 1. Generate asymmetric RSA-OAEP keypair in client browser
      const keypair = await generateAsymmetricDropKeys();

      // 2. Register public key on server
      const res = await fetch('/api/request-drop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          publicKey: keypair.publicKey,
          expireInSeconds: 86400 * 3, // 3 days
        }),
      });

      if (!res.ok) throw new Error('Failed to create inbound drop.');
      const data = await res.json();

      const dropUrl = `${window.location.origin}/#drop=${data.id}&pub=${keypair.publicKey}`;
      setCreatedDrop({
        id: data.id,
        dropUrl: dropUrl,
        privateKey: keypair.privateKey,
      });

    } catch (err: any) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Submitter: Encrypt & Post to Inbound Drop
  const handleSubmitDrop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitterText.trim() || !initialDropId || !initialPublicKey) return;

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      // Encrypt with requester's public key (Hybrid RSA-OAEP + AES-GCM)
      const encrypted = await encryptInboundDrop(
        {
          text: submitterText.trim(),
          formatter: 'env',
        },
        initialPublicKey
      );

      const res = await fetch(`/api/request-drop/${initialDropId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedPayload: encrypted }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit secret.');
      }

      setSubmitSuccess(true);
    } catch (err: any) {
      setSubmitError(err.message || 'Error submitting secret.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ----------------------------------------------------
  // SUBMITTER VIEW (Opening an Inbound Drop link)
  // ----------------------------------------------------
  if (isSubmitter) {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <TerminalWindow path="anonymous@cipherdrop — inbound-drop" glow className="shadow-2xl">
        <div className="p-6 sm:p-8 space-y-6">

          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-mono text-lg font-bold text-slate-100">Secure Inbound Secret Drop</h2>
              <p className="text-xs text-slate-400 font-mono">Zero-Knowledge Public-Key Encryption</p>
            </div>
          </div>

          {dropInfo && (
            <div className="p-4 bg-obsidian-950 rounded-2xl border border-white/5 space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">Requester's Prompt</span>
              <p className="text-xs text-slate-200 font-sans leading-relaxed">{dropInfo.prompt}</p>
            </div>
          )}

          {submitSuccess ? (
            <div className="p-6 bg-emerald-950/30 rounded-2xl border border-emerald-500/30 text-center space-y-3">
              <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-100">Secret Encrypted & Delivered</h3>
              <p className="text-xs text-slate-400">
                Your credentials were encrypted with the requester's public key before submission. Only the requester can decrypt this data.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmitDrop} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-300 uppercase mb-1">
                  Confidential Payload to Submit
                </label>
                <textarea
                  value={submitterText}
                  onChange={(e) => setSubmitterText(e.target.value)}
                  placeholder="Paste requested keys, tokens, or credentials here…"
                  rows={6}
                  className="w-full glass-input p-3 rounded-xl text-xs font-mono text-emerald-200 placeholder:text-slate-600 focus:outline-none resize-none"
                />
              </div>

              {submitError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !submitterText.trim()}
                className="btn-cyber-primary w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Encrypting with RSA-OAEP...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Encrypt & Send to Requester</span>
                  </>
                )}
              </button>
            </form>
          )}

        </div>
        </TerminalWindow>
      </div>
    );
  }

  // ----------------------------------------------------
  // REQUESTER VIEW (Creating Inbound Drop link & Waiting)
  // ----------------------------------------------------
  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Intro Banner */}
      <TerminalWindow path="anonymous@cipherdrop — request-drop" glow>
      <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Inbox className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-mono text-base font-bold text-slate-100 flex items-center gap-2">
              Request-a-Secret DropBox
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Inbound Zero-Knowledge
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Need credentials from a non-technical client or colleague? Generate a single-use inbound drop link.
            </p>
          </div>
        </div>
      </div>
      </TerminalWindow>

      {!createdDrop ? (
        /* Create Drop Form */
        <TerminalWindow path="anonymous@cipherdrop — request-drop --new">
        <div className="p-6 sm:p-8 space-y-6">
          <form onSubmit={handleCreateDropLink} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-300 uppercase mb-1">
                Custom Instruction / Prompt for the Submitter
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Please share the production AWS S3 credentials and database URI…"
                rows={3}
                className="w-full glass-input p-3 rounded-xl text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none resize-none"
              />
            </div>

            <div className="p-4 bg-obsidian-950 rounded-2xl border border-white/5 space-y-2 text-xs">
              <h4 className="font-mono font-bold text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> How Inbound Drops Work
              </h4>
              <p className="text-slate-400 leading-relaxed">
                1. Your browser creates an ephemeral RSA-2048 keypair. The private key remains exclusively in your browser session.<br />
                2. You share the link containing your public key.<br />
                3. The submitter enters their secret; their browser encrypts it with your public key before sending.<br />
                4. Only your browser can decrypt the incoming payload.
              </p>
            </div>

            <button
              type="submit"
              disabled={isGenerating || !prompt.trim()}
              className="btn-cyber-primary flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Generating Asymmetric Keypair...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Inbound Drop Link</span>
                </>
              )}
            </button>
          </form>
        </div>
        </TerminalWindow>
      ) : (
        /* Drop Created & Listening State */
        <div className="space-y-6">

          {/* Link Share Box */}
          <TerminalWindow path="anonymous@cipherdrop — request-drop --listening" accent="emerald" glow className="shadow-xl">
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
                Share this Inbound Drop Link
              </h3>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Listening for Submission...</span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-1.5 bg-obsidian-950 rounded-xl border border-emerald-500/30">
              <input
                type="text"
                readOnly
                value={createdDrop.dropUrl}
                className="w-full px-3 py-2 bg-transparent text-xs font-mono text-emerald-200 focus:outline-none"
              />
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(createdDrop.dropUrl);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
                className="btn-cyber-primary flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap"
              >
                {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>
          </div>
          </TerminalWindow>

          {/* Received Secret View */}
          {receivedSecret ? (
            <TerminalWindow path="anonymous@cipherdrop — request-drop --received" accent="emerald" glow>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-emerald-400 font-mono font-bold text-sm">
                <Unlock className="w-5 h-5" />
                <span>Inbound Secret Received & Decrypted!</span>
              </div>
              <pre className="font-mono text-xs text-emerald-200 p-4 bg-obsidian-950 rounded-2xl border border-white/5 leading-relaxed overflow-x-auto selection:bg-emerald-500/40">
                <code>{receivedSecret.text}</code>
              </pre>
            </div>
            </TerminalWindow>
          ) : (
            <div className="p-8 text-center glass-panel rounded-3xl border border-dashed border-white/10 space-y-3">
              <RefreshCw className="w-8 h-8 text-emerald-400 mx-auto animate-spin" />
              <h4 className="text-xs font-bold font-mono text-slate-200">Awaiting Inbound Submission</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Keep this tab open. As soon as the recipient submits their secret, this screen will automatically decrypt and display the payload using your local private key.
              </p>
            </div>
          )}
        </div>
      )}

      <FeatureHighlights
        title="Inbound Drop Security"
        cards={[
          { icon: <Lock className="w-5 h-5" />, title: 'End-to-End Encrypted', description: 'RSA-OAEP hybrid encryption ensures only the requester can decrypt submitted secrets.' },
          { icon: <KeyRound className="w-5 h-5" />, title: 'Zero Pre-Shared Keys', description: 'No shared passwords or prior key exchange required between requester and submitter.' },
          { icon: <ShieldCheck className="w-5 h-5" />, title: 'Client-Side Keypair', description: 'RSA-OAEP 2048-bit keypair generated entirely in browser memory. Private key never leaves.' },
          { icon: <Clock className="w-5 h-5" />, title: 'Auto-Expiring Links', description: 'Drop links automatically expire after the configured TTL. One-time use enforced.' },
        ]}
      />

    </div>
  );
};
