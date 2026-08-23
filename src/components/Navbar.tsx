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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <div 
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => {
              setActiveTab('create');
              onNewSecret();
            }}
          >
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-6 h-6 text-obsidian-950 stroke-[2.5]" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-400">
                  Cipher<span className="text-emerald-400">Drop</span>
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                  E2EE v2.0
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono hidden sm:block">Zero-Knowledge Sovereign Exchange</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1.5 bg-obsidian-900/80 p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setActiveTab('create')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                activeTab === 'create'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              New Secret
            </button>

            <button
              onClick={() => setActiveTab('request-drop')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                activeTab === 'request-drop'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              Request Drop
            </button>

            <button
              onClick={() => setActiveTab('incident-room')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                activeTab === 'incident-room'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              Incident Room
            </button>

            <button
              onClick={() => setActiveTab('stego')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                activeTab === 'stego'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Stego Disguise
            </button>

            <button
              onClick={() => setActiveTab('vault')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                activeTab === 'vault'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              Offline Vault
            </button>

            <button
              onClick={() => setActiveTab('api-docs')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                activeTab === 'api-docs'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              API & CLI
            </button>
          </nav>

          {/* Quick Actions & Security Status */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>AES-GCM-256</span>
            </div>

            <button
              onClick={() => {
                setActiveTab('create');
                onNewSecret();
              }}
              className="btn-cyber-primary flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">New Secret</span>
            </button>
          </div>

        </div>

        {/* Mobile Navigation Row */}
        <div className="flex md:hidden overflow-x-auto py-2 gap-2 border-t border-white/5 scrollbar-none">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-3 py-1 text-xs whitespace-nowrap rounded-lg ${
              activeTab === 'create' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400'
            }`}
          >
            New Secret
          </button>
          <button
            onClick={() => setActiveTab('request-drop')}
            className={`px-3 py-1 text-xs whitespace-nowrap rounded-lg ${
              activeTab === 'request-drop' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400'
            }`}
          >
            Request Drop
          </button>
          <button
            onClick={() => setActiveTab('incident-room')}
            className={`px-3 py-1 text-xs whitespace-nowrap rounded-lg ${
              activeTab === 'incident-room' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400'
            }`}
          >
            Incident Room
          </button>
          <button
            onClick={() => setActiveTab('stego')}
            className={`px-3 py-1 text-xs whitespace-nowrap rounded-lg ${
              activeTab === 'stego' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400'
            }`}
          >
            Stego
          </button>
          <button
            onClick={() => setActiveTab('vault')}
            className={`px-3 py-1 text-xs whitespace-nowrap rounded-lg ${
              activeTab === 'vault' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400'
            }`}
          >
            Vault
          </button>
          <button
            onClick={() => setActiveTab('api-docs')}
            className={`px-3 py-1 text-xs whitespace-nowrap rounded-lg ${
              activeTab === 'api-docs' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400'
            }`}
          >
            API
          </button>
        </div>
      </div>
    </header>
  );
};
