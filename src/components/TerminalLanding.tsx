import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

interface TerminalLandingProps {
  onEnter: () => void;
}

type LineKind = 'input' | 'output' | 'success' | 'muted';

interface BootLine {
  text: string;
  kind: LineKind;
  /** ms per character; 0 = render instantly (used for blank spacer lines) */
  speed?: number;
  /** pause after this line finishes, before the next one starts typing */
  pause?: number;
}

const BOOT_SEQUENCE: BootLine[] = [
  { text: '$ whoami', kind: 'input', speed: 28 },
  { text: '> anonymous', kind: 'output', pause: 150 },
  { text: '$ cipherdrop --init', kind: 'input', speed: 28 },
  { text: '> generating 256-bit master key in-browser…', kind: 'output' },
  { text: '> AES-256-GCM ................ ready', kind: 'success' },
  { text: '> PBKDF2-HMAC-SHA256 (600,000 rounds) . ready', kind: 'success', pause: 150 },
  { text: '$ cipherdrop --check-server-trust', kind: 'input', speed: 28 },
  { text: '> server can read plaintext? ......... no', kind: 'success' },
  { text: '> server holds decryption keys? ...... no', kind: 'success' },
  { text: '> trust boundary ..................... you', kind: 'success', pause: 250 },
  { text: '', kind: 'muted', speed: 0, pause: 100 },
  { text: 'READY.', kind: 'success', speed: 40 },
];

const TYPE_SPEED_DEFAULT = 16;

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = () => setReduced(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

const LINE_CLASSES: Record<LineKind, string> = {
  input: 'text-slate-100',
  output: 'text-slate-400',
  success: 'text-emerald-400',
  muted: 'text-slate-600',
};

export const TerminalLanding: React.FC<TerminalLandingProps> = ({ onEnter }) => {
  const reducedMotion = useReducedMotion();
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  const [typingIndex, setTypingIndex] = useState(0);
  const [typingChars, setTypingChars] = useState(0);
  const [bootComplete, setBootComplete] = useState(false);
  const enterButtonRef = useRef<HTMLButtonElement>(null);
  const skippedRef = useRef(false);

  // Instantly render the full boot sequence (used for reduced-motion and skip)
  const finishBoot = () => {
    if (skippedRef.current) return;
    skippedRef.current = true;
    setVisibleLines(BOOT_SEQUENCE.map((l) => l.text));
    setBootComplete(true);
  };

  useEffect(() => {
    if (reducedMotion) {
      finishBoot();
      return;
    }

    if (typingIndex >= BOOT_SEQUENCE.length) {
      setBootComplete(true);
      return;
    }

    const line = BOOT_SEQUENCE[typingIndex];
    const speed = line.speed ?? TYPE_SPEED_DEFAULT;

    if (speed === 0) {
      setVisibleLines((prev) => [...prev, line.text]);
      const t = setTimeout(() => {
        if (skippedRef.current) return;
        setTypingIndex((i) => i + 1);
        setTypingChars(0);
      }, line.pause ?? 0);
      return () => clearTimeout(t);
    }

    if (typingChars <= line.text.length) {
      const t = setTimeout(() => {
        if (skippedRef.current) return;
        setVisibleLines((prev) => {
          const next = [...prev];
          next[typingIndex] = line.text.slice(0, typingChars);
          return next;
        });
        setTypingChars((c) => c + 1);
      }, speed);
      return () => clearTimeout(t);
    }

    const t = setTimeout(() => {
      if (skippedRef.current) return;
      setTypingIndex((i) => i + 1);
      setTypingChars(0);
    }, line.pause ?? 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typingIndex, typingChars, reducedMotion]);

  // Once boot completes, move focus to the primary action for keyboard users
  useEffect(() => {
    if (bootComplete) {
      enterButtonRef.current?.focus();
    }
  }, [bootComplete]);

  // Any keypress fast-forwards the boot sequence; Enter/Space on the finished
  // screen proceeds into the site.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!bootComplete) {
        finishBoot();
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onEnter();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootComplete]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-obsidian-950 px-4 overflow-y-auto py-10"
      role="dialog"
      aria-label="CipherDrop terminal introduction"
    >
      {/* Ambient background, consistent with the rest of the app */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl bg-glow-1"></div>
        <div className="absolute top-1/2 -right-40 w-96 h-96 bg-emerald-700/5 rounded-full blur-3xl bg-glow-2"></div>
        <div className="absolute inset-0 grid-pattern opacity-40"></div>
        <div className="absolute inset-0 scanline-bg opacity-30"></div>
      </div>

      <div className="w-full max-w-2xl">
        {/* Wordmark, echoing the Navbar identity so the handoff feels continuous */}
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/20">
            <ShieldCheck className="w-4.5 h-4.5 text-obsidian-950 stroke-[2.5]" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white">
            Cipher<span className="text-emerald-400">Drop</span>
          </span>
        </div>

        {/* Terminal window */}
        <div className="glass-panel-glow rounded-2xl overflow-hidden">
          {/* Title bar */}
          <div className="flex items-center gap-2 px-4 py-3 bg-obsidian-950/90 border-b border-white/5">
            <div className="flex items-center gap-1.5 flex-shrink-0 w-[60px]">
              <span className="w-3 h-3 rounded-full bg-rose-500/70"></span>
              <span className="w-3 h-3 rounded-full bg-amber-500/70"></span>
              <span className="w-3 h-3 rounded-full bg-emerald-500/70"></span>
            </div>
            <span className="flex-1 min-w-0 text-center text-[11px] font-mono text-slate-500 truncate">
              anonymous@crypton&nbsp;—&nbsp;zsh
            </span>
            {/* Mirrors the traffic-light width so the path stays optically centered */}
            <div className="w-[60px] flex-shrink-0" aria-hidden="true" />
          </div>

          {/* Boot output */}
          <div
            className="p-5 sm:p-6 font-mono text-[13px] sm:text-sm leading-relaxed min-h-[280px]"
            aria-live="polite"
          >
            {visibleLines.map((text, i) => (
              <div key={i} className={`${LINE_CLASSES[BOOT_SEQUENCE[i].kind]} min-h-[1.4em]`}>
                {text}
                {!bootComplete && i === typingIndex && (
                  <span className="inline-block w-2 h-4 -mb-0.5 ml-0.5 bg-emerald-400 terminal-cursor" />
                )}
              </div>
            ))}

            {bootComplete && (
              <button
                ref={enterButtonRef}
                type="button"
                onClick={onEnter}
                className="mt-5 flex items-center gap-2 text-left text-slate-100 hover:text-emerald-300 transition-colors focus-visible:outline-none group"
              >
                <span className="text-emerald-400">$</span>
                <span className="border-b border-dashed border-white/20 group-hover:border-emerald-400/50">
                  press enter to continue
                </span>
                <span className="inline-block w-2 h-4 -mb-0.5 bg-emerald-400 terminal-cursor" />
              </button>
            )}
          </div>
        </div>

        {/* Skip control — always available, never blocks a returning/impatient visitor */}
        <div className="text-center mt-5">
          <button
            type="button"
            onClick={bootComplete ? onEnter : finishBoot}
            className="text-[11px] font-mono text-slate-600 hover:text-slate-400 transition-colors underline underline-offset-4 decoration-dotted"
          >
            {bootComplete ? 'skip to CipherDrop →' : 'skip intro →'}
          </button>
        </div>
      </div>
    </div>
  );
};
