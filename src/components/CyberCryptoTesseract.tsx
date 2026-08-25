import React, { useState, useRef } from 'react';
import { Shield, Lock, Unlock, Key, Cpu, Zap } from 'lucide-react';
import { cyberAudio } from '../utils/cyberAudio';

export const CyberCryptoTesseract: React.FC = () => {
  const [isLocked, setIsLocked] = useState(true);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 30;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -30;
    setTilt({ x, y });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  const handleToggleLock = () => {
    setIsLocked(!isLocked);
    if (isLocked) {
      cyberAudio.playDecryptSuccess();
    } else {
      cyberAudio.playQuantumBeep(520, 0.08);
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleToggleLock}
      className="relative w-48 h-48 sm:w-56 sm:h-56 mx-auto cursor-pointer group select-none flex items-center justify-center"
      style={{ perspective: '800px' }}
      title="Click to interact with Sovereign Cryptographic Core"
    >
      {/* 3D Rotating Container */}
      <div
        className="relative w-full h-full flex items-center justify-center transition-transform duration-300 ease-out"
        style={{
          transformStyle: 'preserve-3d',
          transform: `rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)`,
        }}
      >
        {/* Ambient Glow Aura */}
        <div className="absolute inset-4 rounded-full bg-gradient-to-tr from-emerald-500/20 via-cyan-500/15 to-teal-500/20 blur-2xl group-hover:scale-110 transition-transform duration-500 animate-pulse"></div>

        {/* Outer Ring: Rotating Dashed Ring */}
        <svg className="absolute inset-0 w-full h-full animate-[spin_24s_linear_infinite] opacity-60 group-hover:opacity-100 transition-opacity">
          <circle
            cx="50%"
            cy="50%"
            r="44%"
            fill="none"
            stroke="rgba(16, 185, 129, 0.3)"
            strokeWidth="1.5"
            strokeDasharray="6 8 16 8"
          />
          <circle
            cx="50%"
            cy="50%"
            r="44%"
            fill="none"
            stroke="rgba(6, 182, 212, 0.5)"
            strokeWidth="2"
            strokeDasharray="4 40"
          />
        </svg>

        {/* Counter-Rotating Middle Gyroscope */}
        <svg className="absolute inset-2 w-[calc(100%-1rem)] h-[calc(100%-1rem)] animate-[spin_16s_linear_infinite_reverse] opacity-75">
          <circle
            cx="50%"
            cy="50%"
            r="38%"
            fill="none"
            stroke="rgba(52, 211, 153, 0.4)"
            strokeWidth="1.5"
            strokeDasharray="2 12"
          />
          {/* Orbital Satellite Nodes */}
          <circle cx="88%" cy="50%" r="3" fill="#10b981" className="shadow-[0_0_8px_#10b981]" />
          <circle cx="12%" cy="50%" r="3" fill="#06b6d4" className="shadow-[0_0_8px_#06b6d4]" />
        </svg>

        {/* 3D Wireframe Hexagon Cage */}
        <div className="absolute w-28 h-28 sm:w-32 sm:h-32 border border-emerald-500/30 rounded-2xl bg-obsidian-950/60 backdrop-blur-md flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.15)] group-hover:border-emerald-400/60 transition-all duration-300 transform group-hover:scale-105">
          
          {/* Corner Notch Accents */}
          <span className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-emerald-400"></span>
          <span className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-emerald-400"></span>
          <span className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-emerald-400"></span>
          <span className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-emerald-400"></span>

          {/* Core Holographic Icon */}
          <div className="relative flex flex-col items-center justify-center space-y-1">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                {isLocked ? (
                  <Lock className="w-6 h-6 text-emerald-400 animate-pulse" />
                ) : (
                  <Unlock className="w-6 h-6 text-cyan-300 animate-bounce" />
                )}
              </div>
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"></span>
            </div>

            <span className="font-mono text-[9px] uppercase tracking-widest text-emerald-400 font-bold">
              {isLocked ? 'E2EE ARMED' : 'UNLOCKED'}
            </span>
          </div>

        </div>

        {/* Floating Cipher Tag Badges */}
        <div className="absolute -top-1 left-2 px-2 py-0.5 rounded-md bg-obsidian-950/90 border border-emerald-500/30 text-[9px] font-mono text-emerald-300 shadow-sm flex items-center gap-1">
          <Cpu className="w-2.5 h-2.5 text-emerald-400" />
          <span>AES-256</span>
        </div>

        <div className="absolute -bottom-1 right-2 px-2 py-0.5 rounded-md bg-obsidian-950/90 border border-cyan-500/30 text-[9px] font-mono text-cyan-300 shadow-sm flex items-center gap-1">
          <Zap className="w-2.5 h-2.5 text-cyan-400" />
          <span>GF(2^8)</span>
        </div>
      </div>
    </div>
  );
};
