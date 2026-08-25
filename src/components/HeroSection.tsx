import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, Zap, ArrowDown, Eye, Users, Clock, FileCode, Terminal, Sparkles, KeyRound } from 'lucide-react';
import { TerminalWindow } from './TerminalWindow';
import { CyberCryptoTesseract } from './CyberCryptoTesseract';
import { cyberAudio } from '../utils/cyberAudio';

interface HeroSectionProps {
  onScrollToEditor: () => void;
  onLoadSample?: (text: string, formatter: string) => void;
  uiMode?: 'guided' | 'operator';
}

function AnimatedCounter({ end, duration = 1500, suffix = '' }: { end: number; duration?: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.ceil(end / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [end, duration]);
  return <span>{count.toLocaleString()}{suffix}</span>;
}

// Operator samples show off the format range (env/markdown/code); guided
// samples are deliberately mundane and always plaintext, matching the
// simplified editor that has no format switcher to put them in.
const SAMPLE_PAYLOADS = [
  {
    label: 'AWS & Stripe .env',
    icon: '⚡',
    formatter: 'env',
    text: 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\nAWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\nSTRIPE_SECRET_KEY=sk_live_51M0CK_PROD_SEC_KEY_998877\nDATABASE_URL=postgres://app_user:9a8b7c6d5e4f@db.internal:5432/production',
  },
  {
    label: 'SSH ED25519 Key',
    icon: '🔑',
    formatter: 'plaintext',
    text: '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW\nQyNTUxOQAAACD7vD1kL0EXAMPLEKEYEXAMPLEKEYEXAMPLEKEYEXAMPLEKEYAAAA\n-----END OPENSSH PRIVATE KEY-----',
  },
  {
    label: 'Whistleblower Memo',
    icon: '🛡️',
    formatter: 'markdown',
    text: '# CONFIDENTIAL INCIDENT REPORT\n\n**Classification**: SENSITIVE / ZERO-KNOWLEDGE E2EE\n**Timestamp**: 2026-08-25T13:30:00Z\n\n- Discovered unpatched vulnerability in authorization pipeline.\n- CEK secured with Shamir M-of-N Quorum and Argon2id memory-hard KDF.',
  },
];

const GUIDED_SAMPLE_PAYLOADS = [
  { label: 'A password', icon: '🔑', formatter: 'plaintext', text: 'Wifi password: correct-horse-battery-staple' },
  { label: 'A private note', icon: '📝', formatter: 'plaintext', text: "Hey — here's the thing I mentioned. Delete after reading." },
];

export const HeroSection: React.FC<HeroSectionProps> = ({ onScrollToEditor, onLoadSample, uiMode = 'guided' }) => {
  const isGuided = uiMode === 'guided';
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem('cipherdrop-hero-dismissed') === 'true';
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    cyberAudio.playClick(600, 0.02);
    setDismissed(true);
    localStorage.setItem('cipherdrop-hero-dismissed', 'true');
  };

  const handleSelectSample = (sample: { text: string; formatter: string }) => {
    cyberAudio.playQuantumBeep(720, 0.04);
    if (onLoadSample) {
      onLoadSample(sample.text, sample.formatter);
    }
    onScrollToEditor();
  };

  // Guided mode: a short, warm reassurance and nothing else — no stat grid,
  // no 3D tesseract, no crypto-protocol diagram. Everything below is
  // genuinely different content, not the same content restyled smaller.
  if (isGuided) {
    return (
      <div className="mb-8 animate-fade-in">
        <TerminalWindow path="anonymous@crypton — welcome" glow stagger={1} bodyClassName="relative">
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 z-10 px-2 py-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors text-xs font-mono"
          >
            ✕ Dismiss
          </button>

          <div className="p-6 sm:p-8 text-center space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Private by default</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight max-w-xl mx-auto">
              Share something secret. <span className="text-emerald-400">We can't read it, either.</span>
            </h1>

            <p className="text-slate-400 text-sm leading-relaxed max-w-lg mx-auto">
              Type it below, set when it should disappear, and get a link to send. It's locked in your
              browser before it ever reaches us — we just hold the lock, not the key.
            </p>

            <div className="pt-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 block mb-2">
                Or try an example:
              </span>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {GUIDED_SAMPLE_PAYLOADS.map((sample) => (
                  <button
                    key={sample.label}
                    onClick={() => handleSelectSample(sample)}
                    className="px-3 py-1.5 rounded-xl bg-obsidian-900/90 hover:bg-emerald-500/15 border border-white/10 hover:border-emerald-500/40 text-xs font-mono text-slate-300 hover:text-emerald-300 flex items-center gap-1.5 transition-all"
                  >
                    <span>{sample.icon}</span>
                    <span>{sample.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-1">
              <button
                onClick={() => {
                  cyberAudio.playClick(900, 0.02);
                  onScrollToEditor();
                }}
                className="btn-cyber-primary inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold"
              >
                <span>Start below</span>
                <ArrowDown className="w-4 h-4 animate-bounce" />
              </button>
            </div>
          </div>
        </TerminalWindow>
      </div>
    );
  }

  return (
    <div className="mb-8 animate-fade-in">
      <TerminalWindow path="anonymous@crypton — sovereign-security-matrix" glow stagger={1} bodyClassName="relative">
        {/* Dismiss control */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 z-10 px-2 py-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors text-xs font-mono"
        >
          ✕ Dismiss
        </button>

        <div className="p-6 sm:p-10">
          
          {/* Main Hero Header with 3D Cyber Tesseract */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center mb-8">
            
            {/* Left Content Column */}
            <div className="lg:col-span-8 space-y-4 text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Zero-Knowledge Sovereign Cryptographic Boundary</span>
              </div>

              <h1 className="font-mono text-2xl sm:text-4xl font-bold text-white tracking-tight leading-tight">
                <span className="text-emerald-500">&gt;</span> Your secrets <span className="bg-gradient-to-r from-emerald-400 via-cyan-300 to-teal-200 bg-clip-text text-transparent">never touch</span> our servers.
              </h1>

              <p className="text-slate-300 text-sm leading-relaxed max-w-2xl font-sans">
                Master encryption keys reside solely inside the client URL fragment (<code className="text-emerald-400 font-mono bg-obsidian-950 px-1.5 py-0.5 rounded border border-emerald-500/30">#k=...</code>) — mathematically withheld from network transport. Hardened with <strong>OWASP 64MB Argon2id</strong>, <strong>Shamir $M$-of-$N$ Quorum Unlock</strong>, and <strong>Leak-Traceable Watermarking</strong>.
              </p>

              {/* Quick Load Interactive Sample Chips */}
              <div className="pt-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-2">
                  ⚡ Try Sample Secret Payloads:
                </span>
                <div className="flex flex-wrap gap-2">
                  {SAMPLE_PAYLOADS.map((sample) => (
                    <button
                      key={sample.label}
                      onClick={() => handleSelectSample(sample)}
                      className="px-3 py-1.5 rounded-xl bg-obsidian-900/90 hover:bg-emerald-500/15 border border-white/10 hover:border-emerald-500/40 text-xs font-mono text-slate-300 hover:text-emerald-300 flex items-center gap-1.5 transition-all shadow-sm hover:scale-105"
                    >
                      <span>{sample.icon}</span>
                      <span>{sample.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: 3D Interactive Cyber Tesseract */}
            <div className="lg:col-span-4 flex flex-col items-center justify-center">
              <CyberCryptoTesseract />
              <span className="text-[10px] font-mono text-slate-500 mt-2">
                [ Interactive 3D Cryptographic Core ]
              </span>
            </div>

          </div>

          {/* Stat Counters Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <div className="text-center p-3.5 rounded-xl bg-white/[0.03] border border-white/5 hover:border-emerald-500/30 transition-colors">
              <div className="text-2xl font-bold hero-stat-value mb-0.5">
                <AnimatedCounter end={256} />-bit
              </div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400 font-mono">AES-GCM Authenticated</div>
            </div>
            <div className="text-center p-3.5 rounded-xl bg-white/[0.03] border border-white/5 hover:border-emerald-500/30 transition-colors">
              <div className="text-2xl font-bold text-cyan-400 mb-0.5">
                64<span className="text-sm font-normal text-cyan-300">MB</span>
              </div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400 font-mono">Argon2id Memory-Hard</div>
            </div>
            <div className="text-center p-3.5 rounded-xl bg-white/[0.03] border border-white/5 hover:border-emerald-500/30 transition-colors">
              <div className="text-2xl font-bold text-emerald-400 mb-0.5">
                <AnimatedCounter end={29} />/<AnimatedCounter end={29} />
              </div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400 font-mono">Verified Tests Passing</div>
            </div>
            <div className="text-center p-3.5 rounded-xl bg-white/[0.03] border border-white/5 hover:border-emerald-500/30 transition-colors">
              <div className="text-2xl font-bold text-teal-300 mb-0.5">
                GF(2^8)
              </div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400 font-mono">Shamir Quorum Shares</div>
            </div>
          </div>

          {/* How It Works Flow */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent"></div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400/80 font-bold">
                Zero-Knowledge Mathematical Protocol Flow
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent"></div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              {/* Step 1 */}
              <div className="relative p-5 rounded-2xl bg-white/[0.02] border border-white/5 group hover:border-emerald-500/30 transition-all hover:bg-emerald-500/[0.02]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flow-step-number">1</div>
                  <h3 className="text-sm font-mono font-bold text-slate-200">Client-Side Cipher</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  AES-256-GCM encryption occurs purely within the browser sandbox. The random master key is generated client-side and never touches network sockets.
                </p>
                <Lock className="absolute top-4 right-4 w-4 h-4 text-emerald-500/20 group-hover:text-emerald-400 transition-colors" />
                <div className="hidden sm:block absolute top-1/2 -right-3 sm:-right-4 transform -translate-y-1/2 text-emerald-500/30">
                  <Zap className="w-4 h-4" />
                </div>
              </div>

              {/* Step 2 */}
              <div className="relative p-5 rounded-2xl bg-white/[0.02] border border-white/5 group hover:border-emerald-500/30 transition-all hover:bg-emerald-500/[0.02]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flow-step-number">2</div>
                  <h3 className="text-sm font-mono font-bold text-slate-200">Blind Storage Relay</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  The SQLite backend receives only opaque Base64URL ciphertext bytes. Zero plaintext, zero keys, zero metadata logs.
                </p>
                <Eye className="absolute top-4 right-4 w-4 h-4 text-emerald-500/20 group-hover:text-cyan-400 transition-colors" />
                <div className="hidden sm:block absolute top-1/2 -right-3 sm:-right-4 transform -translate-y-1/2 text-emerald-500/30">
                  <Zap className="w-4 h-4" />
                </div>
              </div>

              {/* Step 3 */}
              <div className="relative p-5 rounded-2xl bg-white/[0.02] border border-white/5 group hover:border-emerald-500/30 transition-all hover:bg-emerald-500/[0.02]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flow-step-number">3</div>
                  <h3 className="text-sm font-mono font-bold text-slate-200">Sovereign URL Fragment</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Decryption keys reside in the URL fragment identifier (<code className="text-emerald-400/80">#k=...</code>), which HTTP clients are strictly forbidden from transmitting.
                </p>
                <ShieldCheck className="absolute top-4 right-4 w-4 h-4 text-emerald-500/20 group-hover:text-emerald-400 transition-colors" />
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center pt-2">
            <button
              onClick={() => {
                cyberAudio.playClick(900, 0.02);
                onScrollToEditor();
              }}
              className="btn-cyber-primary inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold font-mono tracking-wider shadow-lg hover:scale-105 transition-all"
            >
              <span>Initialize Encrypted Secret Console</span>
              <ArrowDown className="w-4 h-4 animate-bounce" />
            </button>
          </div>

        </div>
      </TerminalWindow>
    </div>
  );
};

