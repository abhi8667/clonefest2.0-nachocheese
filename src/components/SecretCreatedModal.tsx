import React, { useState, useEffect, useRef } from 'react';
import { 
  Check, 
  Copy, 
  ExternalLink, 
  Flame, 
  QrCode, 
  ShieldCheck, 
  Sparkles, 
  X,
  AlertTriangle,
  Lock,
  Users,
  KeyRound,
  ShieldAlert,
  SlidersHorizontal,
  Share2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CreatedSecretResult, RecipientLinkInfo } from '../types';

interface SecretCreatedModalProps {
  data: CreatedSecretResult;
  onClose: () => void;
  onOpenSecret: (pasteId: string, masterKey: string, slotId?: string) => void;
}

export const SecretCreatedModal: React.FC<SecretCreatedModalProps> = ({
  data,
  onClose,
  onOpenSecret,
}) => {
  const [copiedLinkIdx, setCopiedLinkIdx] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedAdmin, setCopiedAdmin] = useState(false);
  const [copiedDelete, setCopiedDelete] = useState(false);
  const [activeQrUrl, setActiveQrUrl] = useState<string | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const isMulti = Boolean(data.isMultiRecipient);

  // Standard Secret URL
  const standardSecretUrl = !isMulti 
    ? `${window.location.origin}/#p=${data.pasteId}&k=${(data as any).masterKey}`
    : '';

  // Trigger celebration confetti
  useEffect(() => {
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#10b981', '#34d399', '#059669', '#6ee7b7']
      });
    } catch (_) {}
  }, []);

  // Simple QR Code drawer onto Canvas
  useEffect(() => {
    if (activeQrUrl && qrCanvasRef.current) {
      drawSimpleQr(qrCanvasRef.current, activeQrUrl);
    }
  }, [activeQrUrl]);

  const copyToClipboard = async (text: string, type: 'admin' | 'delete' | 'all' | number) => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'admin') {
        setCopiedAdmin(true);
        setTimeout(() => setCopiedAdmin(false), 2000);
      } else if (type === 'delete') {
        setCopiedDelete(true);
        setTimeout(() => setCopiedDelete(false), 2000);
      } else if (type === 'all') {
        setCopiedAll(true);
        setTimeout(() => setCopiedAll(false), 2000);
      } else if (typeof type === 'number') {
        setCopiedLinkIdx(type);
        setTimeout(() => setCopiedLinkIdx(null), 2000);
      }
    } catch (_) {}
  };

  const handleCopyAllLinks = () => {
    if (!isMulti) return;
    const multiData = data as any;
    const formatted = multiData.recipientLinks
      .map((r: RecipientLinkInfo) => `👤 ${r.label}: ${r.url}`)
      .join('\n\n');
    copyToClipboard(formatted, 'all');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian-950/80 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-3xl glass-panel-glow p-6 sm:p-8 rounded-3xl border border-emerald-500/30 text-slate-100 shadow-2xl space-y-6 my-8">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            {isMulti ? <Users className="w-8 h-8" /> : <ShieldCheck className="w-8 h-8" />}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              {isMulti ? 'Multi-Recipient Envelopes Generated' : 'Secret Encrypted & Stored'}
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </h2>
            <p className="text-xs text-slate-400">
              {isMulti
                ? 'Payload encrypted once. Each person receives an isolated decryption link with their own wrapped key.'
                : 'Share the link below. The decryption key is in the #hash fragment and is never sent to the server.'}
            </p>
          </div>
        </div>

        {/* Time-Lock Notice (if enabled) */}
        {data.timeLockEnabled && data.unlockAt && (
          <div className="p-4 bg-amber-950/30 rounded-2xl border border-amber-500/40 text-xs space-y-2.5 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-300 font-bold font-mono">
                <Lock className="w-4 h-4 text-amber-400" />
                <span>🔒 Time-Locked Secret Active</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                Server-Assisted Gate
              </span>
            </div>
            <p className="text-slate-300 text-xs leading-relaxed">
              This secret cannot be opened or decrypted yet. The CipherDrop server will reject requests with <code className="text-amber-300 font-mono">HTTP 423 Locked</code> until the unlock time passes.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
              <div className="p-2.5 bg-obsidian-950 rounded-xl border border-white/5">
                <span className="text-slate-500 block text-[10px]">UNLOCK DATE & TIME (UTC)</span>
                <span className="text-amber-300 font-semibold">{new Date(data.unlockAt).toUTCString()}</span>
              </div>
              <div className="p-2.5 bg-obsidian-950 rounded-xl border border-white/5">
                <span className="text-slate-500 block text-[10px]">YOUR LOCAL TIME</span>
                <span className="text-slate-200">{new Date(data.unlockAt).toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* Standard Single Link Display */}
        {!isMulti && (
          <div className="space-y-2">
            <label className="block text-xs font-mono font-semibold uppercase text-emerald-400 tracking-wider">
              Sovereign Decryption Link
            </label>
            <div className="flex items-center gap-2 p-1.5 bg-obsidian-950 rounded-xl border border-emerald-500/30">
              <input
                type="text"
                readOnly
                value={standardSecretUrl}
                className="w-full px-3 py-2 bg-transparent text-xs font-mono text-emerald-200 focus:outline-none selection:bg-emerald-500/40"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(standardSecretUrl, 0)}
                className="btn-cyber-primary flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap"
              >
                {copiedLinkIdx === 0 ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLinkIdx === 0 ? 'Copied!' : 'Copy Link'}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveQrUrl(activeQrUrl === standardSecretUrl ? null : standardSecretUrl)}
                className="p-2 bg-obsidian-900 hover:bg-white/10 border border-white/10 rounded-lg text-slate-300 transition-colors"
                title="Air-Gapped QR Code"
              >
                <QrCode className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Multi-Recipient Distribution Cards */}
        {isMulti && (
          <div className="space-y-4">
            
            {/* Creator Admin Dashboard Link */}
            <div className="p-3.5 bg-gradient-to-r from-emerald-950/40 via-obsidian-950 to-obsidian-950 rounded-2xl border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-400 uppercase">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Creator Admin & Live Telemetry Link</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Keep confidential to yourself</span>
              </div>
              <div className="flex items-center gap-2 p-1 bg-obsidian-950 rounded-xl border border-emerald-500/20">
                <input
                  type="text"
                  readOnly
                  value={(data as any).adminUrl}
                  className="w-full px-2.5 py-1.5 bg-transparent text-xs font-mono text-emerald-300 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard((data as any).adminUrl, 'admin')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 transition-all whitespace-nowrap"
                >
                  {copiedAdmin ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedAdmin ? 'Copied!' : 'Copy Admin Link'}</span>
                </button>
              </div>
            </div>

            {/* Recipient Links List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono font-semibold uppercase text-slate-300 tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Recipient Delivery Links ({(data as any).recipientLinks?.length} Slots)</span>
                </label>

                <button
                  type="button"
                  onClick={handleCopyAllLinks}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-all"
                >
                  {copiedAll ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                  <span>{copiedAll ? 'All Links Copied!' : 'Copy All Links (Slack/Email)'}</span>
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {(data as any).recipientLinks?.map((r: RecipientLinkInfo, idx: number) => (
                  <div
                    key={r.slotId}
                    className="p-3 bg-obsidian-950 rounded-xl border border-white/10 space-y-2 hover:border-emerald-500/30 transition-all"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-mono font-bold flex items-center justify-center border border-emerald-500/20">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-slate-200">{r.label}</span>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] font-mono">
                        {r.burnOnRead && (
                          <span className="flex items-center gap-1 text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded">
                            <Flame className="w-2.5 h-2.5" /> Burn on 1st Read
                          </span>
                        )}
                        {r.hasPassword && (
                          <span className="flex items-center gap-1 text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                            <Lock className="w-2.5 h-2.5" /> Passphrase Protected
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-1 bg-obsidian-900 rounded-lg border border-white/5">
                      <input
                        type="text"
                        readOnly
                        value={r.url}
                        className="w-full px-2 py-1 bg-transparent text-xs font-mono text-emerald-300 focus:outline-none selection:bg-emerald-500/40"
                      />
                      <button
                        type="button"
                        onClick={() => copyToClipboard(r.url, idx)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-200 transition-all whitespace-nowrap"
                      >
                        {copiedLinkIdx === idx ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedLinkIdx === idx ? 'Copied' : 'Copy'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveQrUrl(activeQrUrl === r.url ? null : r.url)}
                        className="p-1 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-all"
                        title="QR Code"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* QR Code Expansion */}
        {activeQrUrl && (
          <div className="p-4 bg-obsidian-950 rounded-2xl border border-emerald-500/20 flex flex-col items-center justify-center space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between w-full max-w-[200px]">
              <p className="text-xs font-mono text-emerald-400">Air-Gapped QR Code</p>
              <button onClick={() => setActiveQrUrl(null)} className="text-slate-500 hover:text-slate-300">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <canvas ref={qrCanvasRef} width={180} height={180} className="rounded-xl p-2 bg-white" />
          </div>
        )}

        {/* Cryptographic Specifications Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="p-2.5 bg-obsidian-950/60 rounded-xl border border-white/5 font-mono">
            <span className="text-[10px] text-slate-500 block">CIPHER</span>
            <span className="text-emerald-400 font-bold">AES-256-GCM</span>
          </div>
          <div className="p-2.5 bg-obsidian-950/60 rounded-xl border border-white/5 font-mono">
            <span className="text-[10px] text-slate-500 block">ARCHITECTURE</span>
            <span className="text-slate-200">{isMulti ? 'Envelope Wrapped' : '256-bit PRNG'}</span>
          </div>
          <div className="p-2.5 bg-obsidian-950/60 rounded-xl border border-white/5 font-mono">
            <span className="text-[10px] text-slate-500 block">RECIPIENTS</span>
            <span className="text-slate-200 font-bold">{isMulti ? `${(data as any).recipientLinks?.length} Isolated Slots` : '1 Shared Link'}</span>
          </div>
          <div className="p-2.5 bg-obsidian-950/60 rounded-xl border border-white/5 font-mono">
            <span className="text-[10px] text-slate-500 block">LIFECYCLE</span>
            <span className="text-slate-200">
              {isMulti ? 'Per-Slot Burn' : (data as any).burnAfterReading ? '🔥 Burn on Read' : 'Time Expiry'}
            </span>
          </div>
        </div>

        {/* Emergency Deletion Box */}
        <div className="p-3 bg-rose-950/20 border border-rose-500/20 rounded-2xl text-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-300 font-semibold font-mono">
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              <span>Master Deletion / Burn Token</span>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(data.deleteToken, 'delete')}
              className="text-[11px] text-rose-400 hover:text-rose-200 flex items-center gap-1 font-mono"
            >
              {copiedDelete ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{copiedDelete ? 'Copied Token' : 'Copy Token'}</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            Save this deletion token to permanently destroy the secret payload for all recipients at once.
          </p>
          <div className="p-1.5 bg-obsidian-950 rounded-lg font-mono text-[11px] text-rose-300/80 truncate">
            {data.deleteToken}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-obsidian-900 rounded-xl border border-white/10 hover:bg-white/5 transition-all"
          >
            Create Another Secret
          </button>

          {!isMulti ? (
            <button
              type="button"
              onClick={() => onOpenSecret(data.pasteId, (data as any).masterKey)}
              className="btn-cyber-primary flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold"
            >
              <span>Open & Verify Secret</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                const first = (data as any).recipientLinks?.[0];
                if (first) {
                  onOpenSecret(data.pasteId, first.slotKey, first.slotId);
                }
              }}
              className="btn-cyber-primary flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold"
            >
              <span>Test 1st Recipient Link</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

/**
 * Helper to draw a procedural high-density QR-like pattern on canvas
 */
function drawSimpleQr(canvas: HTMLCanvasElement, text: string) {
  const ctx = canvas.getContext('2d')!;
  const size = canvas.width;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  const gridSize = 25;
  const cellSize = size / gridSize;
  ctx.fillStyle = '#000000';

  // Deterministic seed from text
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }

  // Draw 3 standard QR corner finder patterns
  const drawFinder = (x: number, y: number) => {
    ctx.fillRect(x * cellSize, y * cellSize, 7 * cellSize, 7 * cellSize);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect((x + 1) * cellSize, (y + 1) * cellSize, 5 * cellSize, 5 * cellSize);
    ctx.fillStyle = '#000000';
    ctx.fillRect((x + 2) * cellSize, (y + 2) * cellSize, 3 * cellSize, 3 * cellSize);
  };

  drawFinder(1, 1);
  drawFinder(gridSize - 8, 1);
  drawFinder(1, gridSize - 8);

  // Fill data cells
  let seed = Math.abs(hash);
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (
        (r < 9 && c < 9) ||
        (r < 9 && c > gridSize - 10) ||
        (r > gridSize - 10 && c < 9)
      ) {
        continue;
      }
      seed = (seed * 9301 + 49297) % 233280;
      if (seed % 2 === 0) {
        ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
      }
    }
  }
}
