import React, { useState, useEffect } from "react";
import { Navbar } from "./components/Navbar";
import { SecretEditor } from "./components/SecretEditor";
import { SecretViewer } from "./components/SecretViewer";
import { SecretCreatedModal } from "./components/SecretCreatedModal";
import { CreatorAdminModal } from "./components/CreatorAdminModal";
import { BuildIntegrityModal } from "./components/BuildIntegrityModal";
import { RequestSecretDrop } from "./components/RequestSecretDrop";
import { IncidentWarRoom } from "./components/IncidentWarRoom";
import { StegoTool } from "./components/StegoTool";
import { LocalVault } from "./components/LocalVault";
import { ApiCliHub } from "./components/ApiCliHub";
import { HeroSection } from "./components/HeroSection";
import { OnboardingLanding } from "./components/OnboardingLanding";
import { CyberMatrixCanvas } from "./components/CyberMatrixCanvas";
import { CyberSecurityHud } from "./components/CyberSecurityHud";
import { CipherBackground } from "./components/CipherBackground";
import { ModeSelectionScreen } from "./components/ModeSelectionScreen";
import { ActiveTab, CreatedSecretResult, SecretFormatter } from "./types";
import { ShieldCheck, Lock, Terminal, Radio, Github } from "lucide-react";

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("create");
  // The Guided/Operator picker is the landing page — it shows on every
  // visit, not just the first. Switching modes later (navbar toggle) is
  // the escape hatch for changing your mind mid-session; it doesn't need
  // to affect what greets you next time.
  const [uiMode, setUiMode] = useState<"guided" | "operator" | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [samplePayload, setSamplePayload] = useState<{ text: string; formatter: SecretFormatter } | null>(null);
  // Same principle as the mode picker: this is a landing/explainer screen,
  // not a one-time tutorial, so it shows on every fresh visit rather than
  // being permanently dismissed after the first.
  const [showOnboarding, setShowOnboarding] = useState<boolean>(true);

  // Initial pick from the ModeSelectionScreen: transitions with a fade/blur.
  const handleModeSelect = (mode: "guided" | "operator") => {
    setIsTransitioning(true);
    setTimeout(() => {
      setUiMode(mode);
      setIsTransitioning(false);
    }, 300);
  };

  // In-app switch (navbar toggle): instant, no re-gating through the
  // full-screen picker. This is the escape hatch — once you're in a mode
  // you are never stuck there.
  const OPERATOR_ONLY_TABS: ActiveTab[] = ["incident-room", "stego", "vault", "api-docs"];
  const handleModeSwitch = (mode: "guided" | "operator") => {
    setUiMode(mode);
    // Dropping into guided mode from an operator-only tab would otherwise
    // leave the user on a screen whose nav button just disappeared.
    if (mode === "guided" && OPERATOR_ONLY_TABS.includes(activeTab)) {
      setActiveTab("create");
      window.location.hash = "";
    }
  };

  const completeOnboarding = () => {
    setShowOnboarding(false);
  };

  // Viewing an existing secret (Standard single-key or Multi-recipient slot)
  const [viewingSecret, setViewingSecret] = useState<{
    pasteId: string;
    masterKey: string;
    slotId?: string;
  } | null>(null);

  // Secret Created Modal State
  const [createdModalData, setCreatedModalData] =
    useState<CreatedSecretResult | null>(null);

  // Creator Admin Dashboard State
  const [adminModalData, setAdminModalData] = useState<{
    pasteId: string;
    adminToken: string;
  } | null>(null);

  // Verifiable Build Integrity Modal State
  const [showVerifyModal, setShowVerifyModal] = useState<boolean>(false);

  // URL Hash-based routing state
  const [inboundDropParams, setInboundDropParams] = useState<{
    dropId: string;
    pubKey: string;
  } | null>(null);
  const [warRoomParams, setWarRoomParams] = useState<{
    roomId: string;
    roomKey: string;
  } | null>(null);

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
      const p = params.get("p");
      const k = params.get("k");
      const slot = params.get("slot");
      if (p && k) {
        setViewingSecret({
          pasteId: p,
          masterKey: k,
          slotId: slot || undefined,
        });
        return;
      }

      // 2. Creator Admin Route: #admin=<pasteId>&token=<adminToken>
      const admin = params.get("admin");
      const token = params.get("token");
      if (admin && token) {
        setAdminModalData({ pasteId: admin, adminToken: token });
        return;
      }

      // 3. Inbound Drop Route: #drop=<dropId>&pub=<pubKey>
      const drop = params.get("drop");
      const pub = params.get("pub");
      if (drop && pub) {
        setInboundDropParams({ dropId: drop, pubKey: pub });
        setActiveTab("request-drop");
        return;
      }

      // 4. War Room Route: #warroom=<roomId>&key=<roomKey>
      const warroom = params.get("warroom");
      const roomKey = params.get("key");
      if (warroom && roomKey) {
        setWarRoomParams({ roomId: warroom, roomKey: roomKey });
        setActiveTab("incident-room");
        return;
      }
    };

    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  const handleSecretCreated = (result: CreatedSecretResult) => {
    setCreatedModalData(result);
  };

  const handleOpenSecret = (
    pasteId: string,
    masterKey: string,
    slotId?: string,
  ) => {
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
    setSamplePayload(null);
    window.location.hash = "";
  };

  if (!uiMode) {
    return (
      <div
        className={`
          transition-all duration-500 ease-out
          ${
            isTransitioning
              ? "opacity-0 scale-[0.98] blur-[2px]"
              : "opacity-100 scale-100 blur-0"
          }
        `}
      >
        <ModeSelectionScreen onSelect={handleModeSelect} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080D0F] text-slate-100 flex flex-col justify-between selection:bg-emerald-500/30 selection:text-emerald-300 relative">
      {/* Background Cyber Canvas & Ambient Lights */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <CipherBackground />
      </div>

      {/* Content Layer */}
      <div className="relative z-10 flex min-h-screen flex-col justify-between">
        <div>
          {/* Top Navigation */}
          <Navbar
            activeTab={activeTab}
            setActiveTab={(tab) => {
              setViewingSecret(null);
              window.location.hash = "";
              setActiveTab(tab);
            }}
            onNewSecret={handleNewSecret}
            uiMode={uiMode}
            onModeSwitch={handleModeSwitch}
            onOpenVerifyModal={() => setShowVerifyModal(true)}
          />

          {/* Live Security Posture & Operations HUD */}
          <div className="pt-4 px-4 sm:px-6 lg:px-8">
            <CyberSecurityHud />
          </div>

          {/* Main Content Area */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
            {viewingSecret ? (
              <SecretViewer
                pasteId={viewingSecret.pasteId}
                masterKey={viewingSecret.masterKey}
                slotId={viewingSecret.slotId}
                onClose={handleNewSecret}
              />
            ) : (
              <div key={activeTab} className="animate-fade-in">
                {activeTab === "create" &&
                  (showOnboarding ? (
                    <OnboardingLanding onEnter={completeOnboarding} />
                  ) : (
                    <>
                      <HeroSection
                        uiMode={uiMode ?? undefined}
                        onScrollToEditor={() => {
                          const el = document.getElementById("secret-editor-container");
                          if (el) el.scrollIntoView({ behavior: "smooth" });
                        }}
                        onLoadSample={(text, fmt) => {
                          setSamplePayload({ text, formatter: fmt as SecretFormatter });
                        }}
                      />
                      <div id="secret-editor-container">
                        <SecretEditor
                          uiMode={uiMode ?? undefined}
                          onSecretCreated={handleSecretCreated}
                          initialText={samplePayload?.text}
                          initialFormatter={samplePayload?.formatter}
                        />
                      </div>
                    </>
                  ))}

                {activeTab === "request-drop" && (
                  <RequestSecretDrop
                    initialDropId={inboundDropParams?.dropId}
                    initialPublicKey={inboundDropParams?.pubKey}
                  />
                )}

                {activeTab === "incident-room" && (
                  <IncidentWarRoom
                    initialRoomId={warRoomParams?.roomId}
                    initialRoomKey={warRoomParams?.roomKey}
                  />
                )}

                {activeTab === "stego" && <StegoTool />}

                {activeTab === "vault" && <LocalVault />}

                {activeTab === "api-docs" && <ApiCliHub />}
              </div>
            )}
          </main>
        </div>

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
              window.location.hash = "";
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
        <footer className="border-t border-white/10 bg-obsidian-950/90 backdrop-blur-md py-6 text-xs text-slate-500 font-mono mt-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4">
              {/* Row 1: Brand + Crypto Badges */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-slate-300 font-bold">crypton</span>
                  <span className="px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                    E2EE v2.0
                  </span>
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
                <span className="text-slate-600">
                  Zero-Knowledge Sovereign Secret Exchange Platform
                </span>
                <div className="flex items-center gap-4 text-slate-500">
                  <a
                    href="https://github.com/daivikmank-bit/Crypton"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-emerald-400 transition-colors flex items-center gap-1"
                  >
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
                    onClick={() => {
                      setActiveTab("create" as ActiveTab);
                      window.location.hash = "";
                      setViewingSecret(null);
                      setShowOnboarding(true);
                    }}
                  >
                    How It Works
                  </span>
                  <span className="text-white/10">|</span>
                  <span
                    className="hover:text-emerald-400 transition-colors cursor-pointer"
                    onClick={() => {
                      setActiveTab("api-docs" as ActiveTab);
                      window.location.hash = "";
                    }}
                  >
                    API Docs
                  </span>
                  <span className="text-white/10">|</span>
                  <span className="text-slate-600">MIT License</span>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
