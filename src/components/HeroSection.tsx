import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, Zap, ArrowDown, Eye, Users, Clock, FileCode } from 'lucide-react';

interface HeroSectionProps {
  onScrollToEditor: () => void;
}

function AnimatedCounter({ end, duration = 2000, suffix = '' }: { end: number; duration?: number; suffix?: string }) {
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

export const HeroSection: React.FC<HeroSectionProps> = ({ onScrollToEditor }) => {
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem('cipherdrop-hero-dismissed') === 'true';
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('cipherdrop-hero-dismissed', 'true');
  };

  return (
    <div className="mb-8 animate-fade-in">
      {/* Hero Banner */}
      <div className="relative rounded-2xl overflow-hidden glass-panel-glow p-8 sm:p-10">
        {/* Dismiss button */}
        <button 
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors text-xs font-mono"
        >
          ✕ Dismiss
        </button>

        <div className="text-center max-w-3xl mx-auto mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Zero-Knowledge Architecture Active
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight">
            Your secrets <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">never touch</span> our servers.
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-xl mx-auto">
            Keys live exclusively in the URL fragment — never transmitted over the wire.
            Client-side AES-256-GCM encryption with mathematically provable zero-knowledge guarantees.
          </p>
        </div>

        {/* Stat Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="text-center p-4 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="text-2xl font-bold hero-stat-value mb-1">
              <AnimatedCounter end={256} />
            </div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">Bit AES-GCM</div>
          </div>
          <div className="text-center p-4 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="text-2xl font-bold hero-stat-value mb-1">
              <AnimatedCounter end={600} suffix="k" />
            </div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">PBKDF2 Iterations</div>
          </div>
          <div className="text-center p-4 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="text-2xl font-bold hero-stat-value mb-1">
              <AnimatedCounter end={25} />/<AnimatedCounter end={25} />
            </div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">Tests Passing</div>
          </div>
          <div className="text-center p-4 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="text-2xl font-bold hero-stat-value mb-1">
              <AnimatedCounter end={2048} />
            </div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">Bit RSA-OAEP</div>
          </div>
        </div>

        {/* How It Works Flow */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent"></div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400/60">How It Works</span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent"></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {/* Step 1 */}
            <div className="relative p-5 rounded-xl bg-white/[0.02] border border-white/5 group hover:border-emerald-500/20 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="flow-step-number">1</div>
                <h3 className="text-sm font-semibold text-slate-200">Encrypt Locally</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                AES-256-GCM encryption happens entirely inside your browser. The master key is generated client-side and never leaves your device.
              </p>
              <Lock className="absolute top-4 right-4 w-4 h-4 text-emerald-500/20 group-hover:text-emerald-500/40 transition-colors" />
              {/* Connector arrow (hidden on mobile) */}
              <div className="hidden sm:block absolute top-1/2 -right-3 sm:-right-4 transform -translate-y-1/2 text-emerald-500/30">
                <Zap className="w-4 h-4" />
              </div>
            </div>
            {/* Step 2 */}
            <div className="relative p-5 rounded-xl bg-white/[0.02] border border-white/5 group hover:border-emerald-500/20 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="flow-step-number">2</div>
                <h3 className="text-sm font-semibold text-slate-200">Store Blind Ciphertext</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Only encrypted data reaches the server. Zero plaintext, zero keys, zero metadata. The server is treated as fully adversarial.
              </p>
              <Eye className="absolute top-4 right-4 w-4 h-4 text-emerald-500/20 group-hover:text-emerald-500/40 transition-colors" />
              <div className="hidden sm:block absolute top-1/2 -right-3 sm:-right-4 transform -translate-y-1/2 text-emerald-500/30">
                <Zap className="w-4 h-4" />
              </div>
            </div>
            {/* Step 3 */}
            <div className="relative p-5 rounded-xl bg-white/[0.02] border border-white/5 group hover:border-emerald-500/20 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="flow-step-number">3</div>
                <h3 className="text-sm font-semibold text-slate-200">Share via URL Fragment</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                The decryption key is embedded in the URL hash fragment (<code className="text-emerald-400/70">#k=...</code>), which browsers never transmit over HTTP.
              </p>
              <ShieldCheck className="absolute top-4 right-4 w-4 h-4 text-emerald-500/20 group-hover:text-emerald-500/40 transition-colors" />
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <button
            onClick={onScrollToEditor}
            className="inline-flex items-center gap-2 text-xs font-mono text-emerald-400/70 hover:text-emerald-400 transition-colors"
          >
            <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
            Start Encrypting Below
          </button>
        </div>
      </div>
    </div>
  );
};
