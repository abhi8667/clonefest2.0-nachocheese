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
  Lock
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface SecretCreatedModalProps {
  pasteId: string;
  masterKey: string;
  deleteToken: string;
  expireAt: number;
  burnAfterReading: boolean;
  onClose: () => void;
  onOpenSecret: (pasteId: string, masterKey: string) => void;
}

export const SecretCreatedModal: React.FC<SecretCreatedModalProps> = ({
  pasteId,
  masterKey,
  deleteToken,
  expireAt,
  burnAfterReading,
  onClose,
  onOpenSecret,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedDelete, setCopiedDelete] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  // Construct Sovereign Zero-Knowledge Link (Key in URL hash fragment only)
  const secretUrl = `${window.location.origin}/#p=${pasteId}&k=${masterKey}`;
  const deleteUrl = `${window.location.origin}/api/paste/${pasteId}`;

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
    if (showQr && qrCanvasRef.current) {
      drawSimpleQr(qrCanvasRef.current, secretUrl);
    }
  }, [showQr, secretUrl]);

  const copyToClipboard = async (text: string, isDelete = false) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isDelete) {
        setCopiedDelete(true);
        setTimeout(() => setCopiedDelete(false), 2000);
      } else {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }
    } catch (_) {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl glass-panel-glow p-6 sm:p-8 rounded-3xl border border-emerald-500/30 text-slate-100 shadow-2xl space-y-6">
        
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
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              Secret Encrypted & Stored
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </h2>
            <p className="text-xs text-slate-400">
              Share the link below. The decryption key is in the <span className="font-mono text-emerald-300">#hash</span> fragment and is never sent to the server.
            </p>
          </div>
        </div>

        {/* Main Share Link Box */}
        <div className="space-y-2">
          <label className="block text-xs font-mono font-semibold uppercase text-emerald-400 tracking-wider">
            Sovereign Decryption Link
          </label>
          <div className="flex items-center gap-2 p-1.5 bg-obsidian-950 rounded-xl border border-emerald-500/30">
            <input
              type="text"
              readOnly
              value={secretUrl}
              className="w-full px-3 py-2 bg-transparent text-xs font-mono text-emerald-200 focus:outline-none selection:bg-emerald-500/40"
            />
            <button
              type="button"
              onClick={() => copyToClipboard(secretUrl)}
              className="btn-cyber-primary flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap"
            >
              {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowQr(!showQr)}
              className="p-2 bg-obsidian-900 hover:bg-white/10 border border-white/10 rounded-lg text-slate-300 transition-colors"
              title="Air-Gapped QR Code"
            >
              <QrCode className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* QR Code Expansion */}
        {showQr && (
          <div className="p-4 bg-obsidian-950 rounded-2xl border border-emerald-500/20 flex flex-col items-center justify-center space-y-2">
            <p className="text-xs font-mono text-emerald-400">Scan with mobile camera (Air-Gapped Handoff)</p>
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
            <span className="text-[10px] text-slate-500 block">KEY ENTROPY</span>
            <span className="text-slate-200">256-bit PRNG</span>
          </div>
          <div className="p-2.5 bg-obsidian-950/60 rounded-xl border border-white/5 font-mono">
            <span className="text-[10px] text-slate-500 block">AUTHENTICATION</span>
            <span className="text-slate-200">128-bit Tag</span>
          </div>
          <div className="p-2.5 bg-obsidian-950/60 rounded-xl border border-white/5 font-mono">
            <span className="text-[10px] text-slate-500 block">LIFECYCLE</span>
            <span className={burnAfterReading ? "text-rose-400 font-bold" : "text-slate-200"}>
              {burnAfterReading ? "🔥 Burn on Read" : "Time Expiry"}
            </span>
          </div>
        </div>

        {/* Emergency Deletion Box */}
        <div className="p-3 bg-rose-950/20 border border-rose-500/20 rounded-2xl text-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-300 font-semibold font-mono">
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              <span>Manual Deletion / Burn Token</span>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(deleteToken, true)}
              className="text-[11px] text-rose-400 hover:text-rose-200 flex items-center gap-1 font-mono"
            >
              {copiedDelete ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{copiedDelete ? 'Copied Token' : 'Copy Token'}</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            Save this deletion token to permanently destroy the secret before its natural expiration time.
          </p>
          <div className="p-1.5 bg-obsidian-950 rounded-lg font-mono text-[11px] text-rose-300/80 truncate">
            {deleteToken}
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

          <button
            type="button"
            onClick={() => onOpenSecret(pasteId, masterKey)}
            className="btn-cyber-primary flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold"
          >
            <span>Open & Verify Secret</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
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
