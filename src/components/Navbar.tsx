import React, { useState } from "react";
import {
  ShieldCheck,
  PlusCircle,
  Inbox,
  Flame,
  Image as ImageIcon,
  Lock,
  Terminal,
  Volume2,
  VolumeX,
} from "lucide-react";

import { ActiveTab } from "../types";
import { cyberAudio } from "../utils/cyberAudio";

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onNewSecret: () => void;
  uiMode?: "guided" | "operator";
  onOpenVerifyModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onNewSecret,
  uiMode = "guided",
  onOpenVerifyModal,
}) => {
  const [isMuted, setIsMuted] = useState(() => cyberAudio.getMuted());

  const navigate = (tab: ActiveTab) => {
    cyberAudio.playClick(1100, 0.02);
    setActiveTab(tab);
  };

  const handleToggleSound = () => {
    const muted = cyberAudio.toggleMute();
    setIsMuted(muted);
  };

  const isOperator = uiMode === "operator";

  return (
    <header
      className="
        sticky
        top-0
        z-40
        w-full
        py-1
        border-b
        border-white/[0.08]
        bg-[#05080b]/80
        backdrop-blur-xl
      "
    >
      {/* =========================================================
          TOP SYSTEM LINE
      ========================================================= */}

      <div
        className={`
          absolute
          top-0
          left-0
          right-0
          h-px
          ${
            isOperator
              ? "bg-gradient-to-r from-transparent via-[#DE443B]/60 to-transparent"
              : "bg-gradient-to-r from-transparent via-[#00A8E8]/60 to-transparent"
          }
        `}
      />

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* =======================================================
            MAIN NAVBAR
        ======================================================== */}

        <div
          className="
            relative
            flex
            h-[64px]
            items-center
            justify-between
            gap-4
          "
        >
          {/* =====================================================
              BRAND
          ====================================================== */}

          <button
            onClick={() => {
              cyberAudio.playClick(800, 0.02);
              navigate("create");
              onNewSecret();
            }}
            className="
            flex
            items-center
            gap-3
            font-mono
            text-[9px]
            md:text-[10px]
            tracking-[0.25em]
            text-slate-400
            transition-colors
            hover:text-slate-200
          "
          >
            <span
              className="
              h-1.5
              w-1.5
              rounded-full
              bg-cyan-400
              shadow-[0_0_12px_rgba(34,211,238,0.9)]
              animate-pulse"
            />
            crypton // SECURE NODE
          </button>

          {/* =====================================================
              DESKTOP NAVIGATION
          ====================================================== */}

          <nav
            className="
              hidden
              md:flex
              h-full
              items-center
              gap-0.5
            "
          >
            {/* Guided */}

            {!isOperator && (
              <>
                <NavButton
                  active={activeTab === "create"}
                  onClick={() => navigate("create")}
                  icon={<PlusCircle />}
                  label="Create"
                />

                <NavButton
                  active={activeTab === "request-drop"}
                  onClick={() => navigate("request-drop")}
                  icon={<Inbox />}
                  label="Receive"
                />
              </>
            )}

            {/* Operator */}

            {isOperator && (
              <>
                <NavButton
                  active={activeTab === "create"}
                  onClick={() => navigate("create")}
                  icon={<PlusCircle />}
                  label="Create"
                />

                <NavButton
                  active={activeTab === "request-drop"}
                  onClick={() => navigate("request-drop")}
                  icon={<Inbox />}
                  label="Drops"
                />

                <NavButton
                  active={activeTab === "incident-room"}
                  onClick={() => navigate("incident-room")}
                  icon={<Flame />}
                  label="War Room"
                  danger
                />

                <NavButton
                  active={activeTab === "stego"}
                  onClick={() => navigate("stego")}
                  icon={<ImageIcon />}
                  label="Stego"
                />

                <NavButton
                  active={activeTab === "vault"}
                  onClick={() => navigate("vault")}
                  icon={<Lock />}
                  label="Vault"
                />

                <NavButton
                  active={activeTab === "api-docs"}
                  onClick={() => navigate("api-docs")}
                  icon={<Terminal />}
                  label="API / CLI"
                />
              </>
            )}
          </nav>

          {/* =====================================================
              RIGHT SIDE
          ====================================================== */}

          <div
            className="
              flex
              items-center
              gap-2
              shrink-0
            "
          >
            {/* Audio Toggle */}
            <button
              onClick={handleToggleSound}
              className={`p-2 rounded-xl border text-xs font-mono transition-all ${
                !isMuted 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20' 
                  : 'bg-obsidian-900 border-white/10 text-slate-500 hover:text-slate-300'
              }`}
              title={isMuted ? 'Enable Audio FX' : 'Mute Audio FX'}
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

            {/* Mode indicator */}

            <div
              className={`
                hidden
                lg:flex
                items-center
                gap-2
                border
                px-2.5
                py-1.5
                font-mono
                text-[7px]
                tracking-[0.15em]
                ${
                  isOperator
                    ? "border-[#DE443B]/20 text-[#FF8178] bg-[#DE443B]/[0.035]"
                    : "border-[#00A8E8]/20 text-[#4DE4FF] bg-[#00A8E8]/[0.035]"
                }
              `}
            >
              <span
                className={`
                  h-1.5
                  w-1.5
                  rounded-full
                  animate-pulse
                  ${isOperator ? "bg-[#FF6B63]" : "bg-[#4DE4FF]"}
                `}
              />

              {isOperator ? "OPERATOR // ONLINE" : "GUIDED // SECURE"}
            </div>

            {/* Separator */}

            <div
              className="
                hidden
                lg:block
                h-5
                w-px
                bg-white/[0.08]
              "
            />

            {/* New secret */}

            <button
              onClick={() => {
                cyberAudio.playClick(1000, 0.02);
                navigate("create");
                onNewSecret();
              }}
              className="
                group
                relative
                flex
                items-center
                gap-2
                border
                border-[#00A8E8]/30
                bg-[#00A8E8]/[0.07]
                px-3
                py-2
                font-mono
                text-[9px]
                tracking-[0.08em]
                text-[#D7F3FF]
                transition-all
                duration-200
                hover:border-[#4DE4FF]/60
                hover:bg-[#00A8E8]/[0.12]
              "
            >
              <PlusCircle
                className="
                  h-3.5
                  w-3.5
                  text-[#4DE4FF]
                  transition-transform
                  duration-200
                  group-hover:rotate-90
                "
                strokeWidth={1.8}
              />

              <span className="hidden sm:inline">NEW SECRET</span>

              <span className="sm:hidden">NEW</span>
            </button>
          </div>
        </div>

        {/* =======================================================
            MOBILE NAVIGATION
        ======================================================== */}

        <div
          className="
            md:hidden
            flex
            items-center
            gap-1
            overflow-x-auto
            border-t
            border-white/[0.05]
            py-2
            scrollbar-none
          "
        >
          <MobileNavButton
            active={activeTab === "create"}
            onClick={() => navigate("create")}
            label="CREATE"
          />

          <MobileNavButton
            active={activeTab === "request-drop"}
            onClick={() => navigate("request-drop")}
            label={isOperator ? "DROPS" : "RECEIVE"}
          />

          {isOperator && (
            <>
              <MobileNavButton
                active={activeTab === "incident-room"}
                onClick={() => navigate("incident-room")}
                label="WAR ROOM"
                danger
              />

              <MobileNavButton
                active={activeTab === "stego"}
                onClick={() => navigate("stego")}
                label="STEGO"
              />

              <MobileNavButton
                active={activeTab === "vault"}
                onClick={() => navigate("vault")}
                label="VAULT"
              />

              <MobileNavButton
                active={activeTab === "api-docs"}
                onClick={() => navigate("api-docs")}
                label="API / CLI"
              />
            </>
          )}
        </div>
      </div>
    </header>
  );
};

/* =============================================================
   DESKTOP NAV BUTTON
============================================================= */

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
}

function NavButton({ active, onClick, icon, label, danger }: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        group
        relative
        flex
        h-[64px]
        items-center
        gap-2
        px-3
        lg:px-3.5
        font-mono
        text-[9px]
        tracking-[0.08em]
        transition-all
        duration-200

        ${
          active
            ? danger
              ? `
                text-[#FF8178]
                bg-[#DE443B]/[0.045]
              `
              : `
                text-[#4DE4FF]
                bg-[#00A8E8]/[0.045]
              `
            : `
              text-slate-500
              hover:text-slate-200
              hover:bg-white/[0.025]
            `
        }
      `}
    >
      {/* Active top marker */}

      {active && (
        <span
          className={`
            absolute
            left-2
            right-2
            top-0
            h-px
            ${danger ? "bg-[#DE443B]" : "bg-[#00A8E8]"}
          `}
        />
      )}

      {/* Active bottom marker */}

      {active && (
        <span
          className={`
            absolute
            bottom-0
            left-1/2
            h-[2px]
            w-5
            -translate-x-1/2
            ${danger ? "bg-[#DE443B]" : "bg-[#00A8E8]"}
          `}
        />
      )}

      {/* Icon */}

      {React.cloneElement(icon as React.ReactElement, {
        className: `
            h-3.5
            w-3.5
            transition-transform
            duration-200
            group-hover:scale-105
          `,
        strokeWidth: 1.7,
      })}

      {/* Label */}

      <span>{label}</span>
    </button>
  );
}

/* =============================================================
   MOBILE NAV BUTTON
============================================================= */

interface MobileNavButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  danger?: boolean;
}

function MobileNavButton({
  active,
  onClick,
  label,
  danger,
}: MobileNavButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        relative
        shrink-0
        border
        px-3
        py-1.5
        font-mono
        text-[8px]
        tracking-[0.12em]
        transition-all
        duration-200

        ${
          active
            ? danger
              ? `
                border-[#DE443B]/30
                bg-[#DE443B]/[0.07]
                text-[#FF8178]
              `
              : `
                border-[#00A8E8]/30
                bg-[#00A8E8]/[0.07]
                text-[#4DE4FF]
              `
            : `
              border-white/[0.06]
              bg-white/[0.015]
              text-slate-600
              hover:text-slate-300
            `
        }
      `}
    >
      {active && (
        <span
          className={`
            absolute
            left-0
            top-0
            h-full
            w-px
            ${danger ? "bg-[#DE443B]" : "bg-[#00A8E8]"}
          `}
        />
      )}

      {label}
    </button>
  );
}
