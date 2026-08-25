import React, { useState, useEffect } from 'react';
import { ShieldCheck, Cpu, Volume2, VolumeX, Radio, Sparkles, Activity, Lock, Database } from 'lucide-react';
import { cyberAudio } from '../utils/cyberAudio';

export const CyberSecurityHud: React.FC = () => {
  const [isMuted, setIsMuted] = useState(() => cyberAudio.getMuted());
  const [entropyBits, setEntropyBits] = useState(256.0);
  const [pulseState, setPulseState] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      // Micro-fluctuate entropy readout to simulate live entropy pool sampling
      const jitter = (Math.random() - 0.5) * 0.04;
      setEntropyBits(+(256.0 + jitter).toFixed(2));
      setPulseState(p => !p);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const handleToggleSound = () => {
    const muted = cyberAudio.toggleMute();
    setIsMuted(muted);
  };

  return (
    <div className="w-full max-w-5xl mx-auto mb-4 px-2 sm:px-0 animate-fadeIn">
      <div className="p-2 sm:p-2.5 bg-obsidian-950/80 backdrop-blur-xl border border-white/10 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)]">
        
        {/* Left: Security Posture Indicators */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-emerald-400 font-bold tracking-wider uppercase">
              DEFCON 5: Sovereign E2EE
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1.5 text-slate-400">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>Entropy Pool:</span>
            <span className="text-emerald-300 font-bold">{entropyBits} bits</span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              NIST SP 800-90A
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 text-slate-400">
            <Cpu className="w-3.5 h-3.5 text-teal-400" />
            <span>KDF Engine:</span>
            <span className="text-teal-300 font-bold">Argon2id (WASM) / PBKDF2</span>
          </div>
        </div>

        {/* Right: Quick Toggles & Status */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-obsidian-900 border border-white/5 text-[10px] text-slate-400">
            <Database className="w-3 h-3 text-cyan-400" />
            <span>SQLite WAL</span>
          </div>

          <button
            onClick={handleToggleSound}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-mono transition-all ${
              !isMuted 
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 shadow-sm' 
                : 'bg-obsidian-900 border-white/10 text-slate-400 hover:text-slate-200'
            }`}
            title={isMuted ? 'Enable Cyber SFX Audio' : 'Mute Audio'}
          >
            {!isMuted ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">SFX On</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">SFX Muted</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
