import React from 'react';
import { 
  ShieldCheck, 
  PlusCircle, 
  Inbox, 
  Flame, 
  Image as ImageIcon, 
  Lock, 
  Code2,
  Terminal
} from 'lucide-react';
import { ActiveTab } from '../types';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onNewSecret: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onNewSecret }) => {
  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/10">
      {/* Terminal title bar — the whole site lives inside one continuous window frame */}
      <div className="flex items-center gap-2 px-4 sm:px-6 lg:px-8 py-2 border-b border-white/5">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500/70"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70"></span>
        </div>
        <span className="flex-1 text-center text-[10px] font-mono text-slate-600 truncate px-2">
          anonymous@cipherdrop&nbsp;—&nbsp;zsh
        </span>
        <div className="w-[38px] flex-shrink-0" aria-hidden="true" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-2">
        <div className="flex items-center justify-between gap-4 h-16">

          {/* Logo & Brand */}
          <div
            className="flex items-center gap-3 cursor-pointer group flex-shrink-0"
            onClick={() => {
              setActiveTab('create');
              onNewSecret();
            }}
          >
            <div className="relative flex items-center justify-center w-10 h-10 flex-shrink-0 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform duration-200">
              <ShieldCheck className="w-6 h-6 text-obsidian-950 stroke-[2.5]" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight whitespace-nowrap bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-400">
                  Cipher<span className="text-emerald-400">Drop</span>
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider whitespace-nowrap bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                  E2EE v2.0
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono hidden sm:block truncate">Zero-Knowledge Sovereign Exchange</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden xl:flex items-center gap-1.5 flex-shrink-0 bg-obsidian-900/80 p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setActiveTab('create')}
              className={`relative flex items-center gap-2 px-3 py-1.5 text-xs font-mono whitespace-nowrap rounded-lg transition-colors duration-150 ${
                activeTab === 'create'
                  ? 'tab-active-underline bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              New Secret
            </button>

            <button
              onClick={() => setActiveTab('request-drop')}
              className={`relative flex items-center gap-2 px-3 py-1.5 text-xs font-mono whitespace-nowrap rounded-lg transition-colors duration-150 ${
                activeTab === 'request-drop'
                  ? 'tab-active-underline bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              Request Drop
            </button>

            <button
              onClick={() => setActiveTab('incident-room')}
              className={`relative flex items-center gap-2 px-3 py-1.5 text-xs font-mono whitespace-nowrap rounded-lg transition-colors duration-150 ${
                activeTab === 'incident-room'
                  ? 'tab-active-underline bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              Incident Room
            </button>

            <button
              onClick={() => setActiveTab('stego')}
              className={`relative flex items-center gap-2 px-3 py-1.5 text-xs font-mono whitespace-nowrap rounded-lg transition-colors duration-150 ${
                activeTab === 'stego'
                  ? 'tab-active-underline bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Stego
            </button>

            <button
              onClick={() => setActiveTab('vault')}
              className={`relative flex items-center gap-2 px-3 py-1.5 text-xs font-mono whitespace-nowrap rounded-lg transition-colors duration-150 ${
                activeTab === 'vault'
                  ? 'tab-active-underline bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              Vault
            </button>

            <button
              onClick={() => setActiveTab('api-docs')}
              className={`relative flex items-center gap-2 px-3 py-1.5 text-xs font-mono whitespace-nowrap rounded-lg transition-colors duration-150 ${
                activeTab === 'api-docs'
                  ? 'tab-active-underline bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              API
            </button>
          </nav>

          {/* Quick Actions & Security Status */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="hidden 2xl:flex items-center gap-2 px-2.5 py-1 rounded-full whitespace-nowrap bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>AES-GCM-256</span>
            </div>

            <button
              onClick={() => {
                setActiveTab('create');
                onNewSecret();
              }}
              className="btn-cyber-primary flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
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
