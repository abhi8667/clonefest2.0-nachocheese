import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { SecretEditor } from './components/SecretEditor';
import { SecretViewer } from './components/SecretViewer';
import { SecretCreatedModal } from './components/SecretCreatedModal';
import { RequestSecretDrop } from './components/RequestSecretDrop';
import { IncidentWarRoom } from './components/IncidentWarRoom';
import { StegoTool } from './components/StegoTool';
import { LocalVault } from './components/LocalVault';
import { ApiCliHub } from './components/ApiCliHub';
import { ActiveTab } from './types';
import { ShieldCheck, Lock, Terminal, Radio, Github } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('create');

  // Viewing an existing secret
  const [viewingSecret, setViewingSecret] = useState<{ pasteId: string; masterKey: string } | null>(null);

  // Secret Created Modal State
  const [createdModalData, setCreatedModalData] = useState<{
    pasteId: string;
    masterKey: string;
    deleteToken: string;
    expireAt: number;
    burnAfterReading: boolean;
  } | null>(null);

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
        return;
      }

      const params = new URLSearchParams(hash);

      // 1. Paste Viewer Route: #p=<pasteId>&k=<masterKey>
      const p = params.get('p');
      const k = params.get('k');
      if (p && k) {
        setViewingSecret({ pasteId: p, masterKey: k });
        return;
      }

      // 2. Inbound Drop Route: #drop=<dropId>&pub=<pubKey>
      const drop = params.get('drop');
      const pub = params.get('pub');
      if (drop && pub) {
        setInboundDropParams({ dropId: drop, pubKey: pub });
        setActiveTab('request-drop');
        return;
      }

      // 3. War Room Route: #warroom=<roomId>&key=<roomKey>
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

  const handleSecretCreated = (result: {
    pasteId: string;
    masterKey: string;
    deleteToken: string;
    expireAt: number;
    burnAfterReading: boolean;
  }) => {
    setCreatedModalData(result);
  };

  const handleOpenSecret = (pasteId: string, masterKey: string) => {
    setCreatedModalData(null);
    window.location.hash = `p=${pasteId}&k=${masterKey}`;
  };

  const handleNewSecret = () => {
    setViewingSecret(null);
    setCreatedModalData(null);
    window.location.hash = '';
  };

  return (
    <div className="min-h-screen bg-obsidian-950 text-slate-100 flex flex-col justify-between selection:bg-emerald-500/30 selection:text-emerald-300">
      
      {/* Background Decorative Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 -right-40 w-96 h-96 bg-emerald-700/5 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl"></div>
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
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {viewingSecret ? (
          <SecretViewer
            pasteId={viewingSecret.pasteId}
            masterKey={viewingSecret.masterKey}
            onClose={handleNewSecret}
          />
        ) : (
          <>
            {activeTab === 'create' && (
              <SecretEditor onSecretCreated={handleSecretCreated} />
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
          </>
        )}
      </main>

      {/* Secret Created Success Modal */}
      {createdModalData && (
        <SecretCreatedModal
          pasteId={createdModalData.pasteId}
          masterKey={createdModalData.masterKey}
          deleteToken={createdModalData.deleteToken}
          expireAt={createdModalData.expireAt}
          burnAfterReading={createdModalData.burnAfterReading}
          onClose={() => setCreatedModalData(null)}
          onOpenSecret={handleOpenSecret}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-white/5 bg-obsidian-950/80 backdrop-blur-md py-6 text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-slate-300 font-bold">CipherDrop Sovereign Platform</span>
            <span>• E2EE v2.0</span>
          </div>

          <div className="flex items-center gap-6">
            <span>AES-256-GCM</span>
            <span>PBKDF2-SHA256 (600k)</span>
            <span>RSA-OAEP 2048</span>
            <span>Zero Server Knowledge</span>
          </div>
        </div>
      </footer>

    </div>
  );
}

export default App;
