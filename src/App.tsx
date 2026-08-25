import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { SecretEditor } from './components/SecretEditor';
import { SecretViewer } from './components/SecretViewer';
import { SecretCreatedModal } from './components/SecretCreatedModal';
import { CreatorAdminModal } from './components/CreatorAdminModal';
import { BuildIntegrityModal } from './components/BuildIntegrityModal';
import { RequestSecretDrop } from './components/RequestSecretDrop';
import { IncidentWarRoom } from './components/IncidentWarRoom';
import { StegoTool } from './components/StegoTool';
import { LocalVault } from './components/LocalVault';
import { ApiCliHub } from './components/ApiCliHub';
import { HeroSection } from './components/HeroSection';
import { OnboardingLanding } from './components/OnboardingLanding';
import { TerminalLanding } from './components/TerminalLanding';
import { ActiveTab, CreatedSecretResult } from './types';
import { ShieldCheck, Lock, Terminal, Radio, Github } from 'lucide-react';

const ONBOARDING_KEY = 'cipherdrop-onboarding-complete';
const TERMINAL_INTRO_KEY = 'cipherdrop-terminal-intro-seen';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('create');
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    return localStorage.getItem(ONBOARDING_KEY) !== 'true';
  });

  // Deep links (share links, admin links, drop requests, war-room invites) should
  // land directly on their destination, not get gated behind the terminal splash.
  const [showTerminalIntro, setShowTerminalIntro] = useState<boolean>(() => {
    return sessionStorage.getItem(TERMINAL_INTRO_KEY) !== 'true' && !window.location.hash;
  });

  const completeTerminalIntro = () => {
    sessionStorage.setItem(TERMINAL_INTRO_KEY, 'true');
    setShowTerminalIntro(false);
  };

  const completeOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setShowOnboarding(false);
  };

  // Viewing an existing secret (Standard single-key or Multi-recipient slot)
  const [viewingSecret, setViewingSecret] = useState<{ pasteId: string; masterKey: string; slotId?: string } | null>(null);

  // Secret Created Modal State
  const [createdModalData, setCreatedModalData] = useState<CreatedSecretResult | null>(null);

  // Creator Admin Dashboard State
  const [adminModalData, setAdminModalData] = useState<{ pasteId: string; adminToken: string } | null>(null);

  // Verifiable Build Integrity Modal State
  const [showVerifyModal, setShowVerifyModal] = useState<boolean>(false);

  // URL Hash-based routing state
  const [inboundDropParams, setInboundDropParams] = useState<{ dropId: string; pubKey: string } | null>(null);
  const [warRoomParams, setWarRoomParams] = useState<{ roomId: string; roomKey: string } | null>(null);

  // Parse URL Fragment on load and hashchange
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.substring(1); // remove '#'
      if (!hash) {
        setViewingSecret(null);
        setInboundDropParams(null);
        setWarRoomParams(null);
        setAdminModalData(null);
        return;
      }

      const params = new URLSearchParams(hash);

      // 1. Paste Viewer Route: #p=<pasteId>&k=<masterKey>&slot=<slotId>
      const p = params.get('p');
      const k = params.get('k');
      const slot = params.get('slot');
      if (p && k) {
        setViewingSecret({ pasteId: p, masterKey: k, slotId: slot || undefined });
        return;
      }

      // 2. Creator Admin Route: #admin=<pasteId>&token=<adminToken>
      const admin = params.get('admin');
      const token = params.get('token');
      if (admin && token) {
        setAdminModalData({ pasteId: admin, adminToken: token });
        return;
      }

      // 3. Inbound Drop Route: #drop=<dropId>&pub=<pubKey>
      const drop = params.get('drop');
      const pub = params.get('pub');
      if (drop && pub) {
        setInboundDropParams({ dropId: drop, pubKey: pub });
        setActiveTab('request-drop');
        return;
      }

      // 4. War Room Route: #warroom=<roomId>&key=<roomKey>
      const warroom = params.get('warroom');
      const roomKey = params.get('key');
      if (warroom && roomKey) {
        setWarRoomParams({ roomId: warroom, roomKey: roomKey });
        setActiveTab('incident-room');
        return;
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleSecretCreated = (result: CreatedSecretResult) => {
    setCreatedModalData(result);
  };

  const handleOpenSecret = (pasteId: string, masterKey: string, slotId?: string) => {
    setCreatedModalData(null);
    if (slotId) {
      window.location.hash = `p=${pasteId}&slot=${slotId}&k=${masterKey}`;
    } else {
      window.location.hash = `p=${pasteId}&k=${masterKey}`;
    }
  };

  const handleNewSecret = () => {
    setViewingSecret(null);
    setCreatedModalData(null);
    setAdminModalData(null);
    window.location.hash = '';
  };


  if (showTerminalIntro) {
    return <TerminalLanding onEnter={completeTerminalIntro} />;
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-slate-100 flex flex-col justify-between selection:bg-emerald-500/30 selection:text-emerald-300">

      {/* Background Decorative Glows (Animated) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl bg-glow-1"></div>
        <div className="absolute top-1/2 -right-40 w-96 h-96 bg-emerald-700/5 rounded-full blur-3xl bg-glow-2"></div>
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl bg-glow-3"></div>
        <div className="absolute inset-0 grid-pattern opacity-50"></div>
      </div>

      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setViewingSecret(null);
          window.location.hash = '';
          setActiveTab(tab);
        }}
        onNewSecret={handleNewSecret}
        onOpenVerifyModal={() => setShowVerifyModal(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {viewingSecret ? (
          <SecretViewer
            pasteId={viewingSecret.pasteId}
            masterKey={viewingSecret.masterKey}
            slotId={viewingSecret.slotId}
            onClose={handleNewSecret}
          />
        ) : (
          <div key={activeTab} className="animate-fade-in">
            {activeTab === 'create' && (
              showOnboarding ? (
                <OnboardingLanding onEnter={completeOnboarding} />
              ) : (
                <>
                  <HeroSection onScrollToEditor={() => {}} />
                  <SecretEditor onSecretCreated={handleSecretCreated} />
                </>
              )
            )}

            {activeTab === 'request-drop' && (
              <RequestSecretDrop
                initialDropId={inboundDropParams?.dropId}
                initialPublicKey={inboundDropParams?.pubKey}
              />
            )}

            {activeTab === 'incident-room' && (
              <IncidentWarRoom
                initialRoomId={warRoomParams?.roomId}
                initialRoomKey={warRoomParams?.roomKey}
              />
            )}

            {activeTab === 'stego' && <StegoTool />}

            {activeTab === 'vault' && <LocalVault />}

            {activeTab === 'api-docs' && <ApiCliHub />}
          </div>
        )}
      </main>

      {/* Secret Created Success Modal */}
      {createdModalData && (
        <SecretCreatedModal
          data={createdModalData}
          onClose={() => setCreatedModalData(null)}
          onOpenSecret={handleOpenSecret}
        />
      )}

      {/* Creator Admin Dashboard Modal */}
      {adminModalData && (
        <CreatorAdminModal
          pasteId={adminModalData.pasteId}
          adminToken={adminModalData.adminToken}
          onClose={() => {
            setAdminModalData(null);
            window.location.hash = '';
          }}
        />
      )}

      {/* Verifiable Build Integrity Modal */}
      {showVerifyModal && (
        <BuildIntegrityModal
          onClose={() => setShowVerifyModal(false)}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-emerald-500/10 bg-obsidian-950/90 backdrop-blur-md py-6 text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4">
            {/* Row 1: Brand + Crypto Badges */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-slate-300 font-bold">CipherDrop</span>
                <span className="px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">E2EE v2.0</span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="crypto-badge">🔒 AES-256-GCM</span>
                <span className="crypto-badge">🛡️ OWASP Argon2id</span>
                <span className="crypto-badge">🧩 Shamir M-of-N</span>
                <span className="crypto-badge">🔍 Traceable Watermark</span>
                <span className="crypto-badge">🔑 RSA-OAEP / ECDH</span>
                <span className="crypto-badge">⏱️ Time-Lock UTC</span>
              </div>
            </div>
            {/* Row 2: Links */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t border-white/5">
              <span className="text-slate-600">Zero-Knowledge Sovereign Secret Exchange Platform</span>
              <div className="flex items-center gap-4 text-slate-500">
                <a href="https://github.com/daivikmank-bit/Crypton" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors flex items-center gap-1">
                  <Github className="w-3.5 h-3.5" /> GitHub
                </a>
                <span className="text-white/10">|</span>
                <span
                  className="hover:text-emerald-400 transition-colors cursor-pointer"
                  onClick={() => setShowVerifyModal(true)}
                >
                  Verify Build
                </span>
                <span className="text-white/10">|</span>
                <span
                  className="hover:text-emerald-400 transition-colors cursor-pointer"
                  onClick={() => { setActiveTab('create' as ActiveTab); window.location.hash = ''; setViewingSecret(null); setShowOnboarding(true); }}
                >
                  How It Works
                </span>
                <span className="text-white/10">|</span>
                <span className="hover:text-emerald-400 transition-colors cursor-pointer" onClick={() => { setActiveTab('api-docs' as ActiveTab); window.location.hash = ''; }}>API Docs</span>
                <span className="text-white/10">|</span>
                <span className="text-slate-600">MIT License</span>
              </div>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}

export default App;
