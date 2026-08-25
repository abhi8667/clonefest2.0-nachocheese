import React, { useState } from 'react';
import { 
  ShieldCheck, 
  PlusCircle, 
  Inbox, 
  Flame, 
  Image as ImageIcon, 
  Lock, 
  Code2,
  Terminal,
  Volume2,
  VolumeX,
  Sparkles,
  Radio
} from 'lucide-react';
import { ActiveTab } from '../types';
import { cyberAudio } from '../utils/cyberAudio';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onNewSecret: () => void;
  onOpenVerifyModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onNewSecret, onOpenVerifyModal }) => {
  const [isMuted, setIsMuted] = useState(() => cyberAudio.getMuted());

  const handleTabClick = (tab: ActiveTab) => {
    cyberAudio.playClick(1100, 0.02);
    setActiveTab(tab);
  };

  const handleToggleSound = () => {
    const muted = cyberAudio.toggleMute();
    setIsMuted(muted);
  };

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/10 backdrop-blur-2xl">
      {/* Terminal title bar — the whole site lives inside one continuous window frame */}
      <div className="flex items-center gap-2 px-4 sm:px-6 lg:px-8 py-1.5 border-b border-white/5 bg-obsidian-950/60">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 shadow-[0_0_6px_#f43f5e]"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 shadow-[0_0_6px_#f59e0b]"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 shadow-[0_0_6px_#10b981]"></span>
        </div>
        <span className="flex-1 text-center text-[10px] font-mono text-slate-500 truncate px-2">
          anonymous@cipherdrop&nbsp;—&nbsp;sovereign-node:0x7F&nbsp;—&nbsp;zsh
        </span>
        <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-400/80">
          <span className="hidden sm:inline">● E2EE 256-BIT</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2.5 pb-2">
        <div className="flex items-center justify-between gap-4 h-14 sm:h-16">

          {/* Logo & Brand */}
          <div
            className="flex items-center gap-3 cursor-pointer group flex-shrink-0"
            onClick={() => {
              cyberAudio.playClick(800, 0.02);
              setActiveTab('create');
              onNewSecret();
            }}
          >
            <div className="relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 rounded-xl bg-gradient-to-br from-emerald-400 via-teal-500 to-emerald-600 shadow-lg shadow-emerald-500/25 group-hover:scale-105 transition-transform duration-200">
              <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-obsidian-950 stroke-[2.5]" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl font-bold tracking-tight whitespace-nowrap bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
                  Cipher<span className="text-emerald-400">Drop</span>
                </span>
                <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider whitespace-nowrap bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 rounded shadow-sm">
                  v2.0 PQC
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono hidden sm:block truncate">Zero-Knowledge Sovereign Exchange</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden xl:flex items-center gap-1.5 flex-shrink-0 bg-obsidian-900/90 p-1 rounded-xl border border-white/10 shadow-inner">
            <button
              onClick={() => handleTabClick('create')}
              className={`relative flex items-center gap-2 px-3.5 py-1.5 text-xs font-mono whitespace-nowrap rounded-lg transition-all duration-150 ${
                activeTab === 'create'
                  ? 'tab-active-underline bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.2)] font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              New Secret
            </button>

            <button
              onClick={() => handleTabClick('request-drop')}
              className={`relative flex items-center gap-2 px-3.5 py-1.5 text-xs font-mono whitespace-nowrap rounded-lg transition-all duration-150 ${
                activeTab === 'request-drop'
                  ? 'tab-active-underline bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.2)] font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              Request Drop
            </button>

            <button
              onClick={() => handleTabClick('incident-room')}
              className={`relative flex items-center gap-2 px-3.5 py-1.5 text-xs font-mono whitespace-nowrap rounded-lg transition-all duration-150 ${
                activeTab === 'incident-room'
                  ? 'tab-active-underline bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              Incident Room
            </button>

            <button
              onClick={() => handleTabClick('stego')}
              className={`relative flex items-center gap-2 px-3.5 py-1.5 text-xs font-mono whitespace-nowrap rounded-lg transition-all duration-150 ${
                activeTab === 'stego'
                  ? 'tab-active-underline bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.2)] font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Stego
            </button>

            <button
              onClick={() => handleTabClick('vault')}
              className={`relative flex items-center gap-2 px-3.5 py-1.5 text-xs font-mono whitespace-nowrap rounded-lg transition-all duration-150 ${
                activeTab === 'vault'
                  ? 'tab-active-underline bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.2)] font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              Vault
            </button>

            <button
              onClick={() => handleTabClick('api-docs')}
              className={`relative flex items-center gap-2 px-3.5 py-1.5 text-xs font-mono whitespace-nowrap rounded-lg transition-all duration-150 ${
                activeTab === 'api-docs'
                  ? 'tab-active-underline bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.2)] font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              API
            </button>
          </nav>

          {/* Quick Actions & Security Status */}
          <div className="flex items-center gap-2 flex-shrink-0">
            
            {/* Audio Toggle */}
            <button
              onClick={handleToggleSound}
              className={`p-2 rounded-xl border text-xs font-mono transition-all ${
                !isMuted 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20' 
                  : 'bg-obsidian-900 border-white/10 text-slate-500 hover:text-slate-300'
              }`}
              title={isMuted ? 'Enable Sci-Fi Audio FX' : 'Mute Audio FX'}
            >
              {!isMuted ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {onOpenVerifyModal && (
              <button
                onClick={() => {
                  cyberAudio.playQuantumBeep(920, 0.05);
                  onOpenVerifyModal();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl whitespace-nowrap bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-400 text-xs font-mono transition-colors shadow-sm"
                title="Verify Build Integrity & SRI Signatures"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline font-bold">ZK Verified</span>
              </button>
            )}

            <button
              onClick={() => {
                cyberAudio.playClick(1000, 0.02);
                setActiveTab('create');
                onNewSecret();
              }}
              className="btn-cyber-primary flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shadow-md hover:scale-105"
            >
              <PlusCircle className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">New Secret</span>
            </button>
          </div>

        </div>

        {/* Mobile / Tablet Navigation Row — shown until the full nav fits at xl */}
        <div className="flex xl:hidden overflow-x-auto py-2 gap-2 border-t border-white/5 scrollbar-none">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-3 py-1.5 min-h-[32px] text-xs font-mono whitespace-nowrap flex-shrink-0 rounded-lg border transition-colors duration-150 ${
              activeTab === 'create' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            New Secret
          </button>
          <button
            onClick={() => setActiveTab('request-drop')}
            className={`px-3 py-1.5 min-h-[32px] text-xs font-mono whitespace-nowrap flex-shrink-0 rounded-lg border transition-colors duration-150 ${
              activeTab === 'request-drop' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            Request Drop
          </button>
          <button
            onClick={() => setActiveTab('incident-room')}
            className={`px-3 py-1.5 min-h-[32px] text-xs font-mono whitespace-nowrap flex-shrink-0 rounded-lg border transition-colors duration-150 ${
              activeTab === 'incident-room' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            Incident Room
          </button>
          <button
            onClick={() => setActiveTab('stego')}
            className={`px-3 py-1.5 min-h-[32px] text-xs font-mono whitespace-nowrap flex-shrink-0 rounded-lg border transition-colors duration-150 ${
              activeTab === 'stego' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            Stego
          </button>
          <button
            onClick={() => setActiveTab('vault')}
            className={`px-3 py-1.5 min-h-[32px] text-xs font-mono whitespace-nowrap flex-shrink-0 rounded-lg border transition-colors duration-150 ${
              activeTab === 'vault' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            Vault
          </button>
          <button
            onClick={() => setActiveTab('api-docs')}
            className={`px-3 py-1.5 min-h-[32px] text-xs font-mono whitespace-nowrap flex-shrink-0 rounded-lg border transition-colors duration-150 ${
              activeTab === 'api-docs' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            API
          </button>
        </div>
      </div>
    </header>
  );
};
