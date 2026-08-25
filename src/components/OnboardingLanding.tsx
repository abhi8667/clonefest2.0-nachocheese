import React from 'react';
import {
  ShieldCheck,
  Lock,
  KeyRound,
  Link as LinkIcon,
  ShieldAlert,
  Users,
  Clock,
  ArrowRight,
  Terminal,
} from 'lucide-react';
import { TerminalWindow } from './TerminalWindow';

interface OnboardingLandingProps {
  onEnter: () => void;
}

const LEDGER_LINES = [
  '$ crypton encrypt --local',
  '> AES-256-GCM key generated in-browser',
  '> plaintext never leaves this device',
  '> key embedded in URL fragment (#k=...)',
  '> server receives ciphertext only',
];

type Accent = 'emerald' | 'amber';

const ACCENT_CLASSES: Record<Accent, { border: string; iconWrap: string; label: string }> = {
  emerald: {
    border: 'hover:border-emerald-500/30',
    iconWrap: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    label: 'text-emerald-400/70',
  },
  amber: {
    border: 'hover:border-amber-500/30',
    iconWrap: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    label: 'text-amber-400/70',
  },
};

const MODES: {
  icon: React.ReactNode;
  title: string;
  when: string;
  body: string;
  accent: Accent;
}[] = [
  {
    icon: <LinkIcon className="w-4 h-4" />,
    title: 'Standard Link',
    when: 'Default choice',
    body: 'One secret, one link, one key in the URL fragment. Use this for the ordinary case: a password, a token, a config snippet you\'re sending to one person.',
    accent: 'emerald',
  },
  {
    icon: <ShieldAlert className="w-4 h-4" />,
    title: 'Duress Mode',
    when: 'You might be forced to unlock it',
    body: 'Set a second password that opens a harmless decoy instead of the real secret. Use it when someone could compel you to hand over the password — a border check, a coerced handoff.',
    accent: 'amber',
  },
  {
    icon: <Users className="w-4 h-4" />,
    title: 'Multi-Recipient Envelopes',
    when: 'More than one person needs access',
    body: 'Encrypt once, wrap the key separately for each recipient. Everyone gets their own link and their own burn state, so revoking one person doesn\'t touch the others.',
    accent: 'emerald',
  },
  {
    icon: <Clock className="w-4 h-4" />,
    title: 'Time-Lock Release',
    when: 'The secret shouldn\'t open yet',
    body: 'The server refuses to release the ciphertext until a date you set — useful for scheduled credential rotations, embargoed announcements, or dead-man releases.',
    accent: 'amber',
  },
];

export const OnboardingLanding: React.FC<OnboardingLandingProps> = ({ onEnter }) => {
  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <TerminalWindow path="anonymous@crypton — man crypton" glow>
        <div className="p-6 sm:p-8">

        {/* Hero / Thesis */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            How Crypton Works
          </div>
          <h1 className="font-mono text-2xl sm:text-3xl font-bold text-white mb-3 tracking-tight">
            We can't read your secret.
            <br />
            <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">That's not a promise, it's math.</span>
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Everything is encrypted in your browser before it ever reaches our servers. We store ciphertext we
            cannot open, and the decryption key travels only inside the link you share.
          </p>
        </div>

        {/* Signature element: terminal ledger of what actually happens */}
        <div className="rounded-xl border border-emerald-500/20 overflow-hidden mb-10 max-w-xl mx-auto bg-obsidian-950/60">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5">
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] font-mono text-slate-400">what happens when you click encrypt</span>
          </div>
          <div className="p-4 font-mono text-[12px] leading-relaxed">
            {LEDGER_LINES.map((line, i) => (
              <div
                key={i}
                className={line.startsWith('$') ? 'text-slate-200' : 'text-emerald-400/90 pl-2'}
              >
                {line}
              </div>
            ))}
          </div>
        </div>

        {/* Mode cards: when to use what */}
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent"></div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400/60">Pick your sharing mode</span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent"></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {MODES.map((mode) => {
              const cls = ACCENT_CLASSES[mode.accent];
              return (
                <div
                  key={mode.title}
                  className={`p-5 rounded-xl bg-white/[0.02] border border-white/5 transition-all ${cls.border}`}
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className={`p-1.5 rounded-lg ${cls.iconWrap}`}>
                      {mode.icon}
                    </div>
                    <h2 className="text-sm font-mono font-semibold text-slate-200">{mode.title}</h2>
                  </div>
                  <p className={`text-[11px] font-mono uppercase tracking-wide mb-2 ${cls.label}`}>
                    Use when: {mode.when}
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">{mode.body}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Fifth card: the guarantee, full width */}
        <div className="p-5 rounded-xl bg-emerald-950/10 border border-emerald-500/15 mb-10 flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex-shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-mono font-semibold text-slate-200 mb-1">
              Everything else in the editor is optional
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              You always get text, an expiry, and an optional password. The modes above live behind an{' '}
              <span className="text-emerald-400 font-mono">Advanced</span> toggle in the editor so you're never
              forced to think about duress passwords or time-locks unless your situation actually calls for one.
            </p>
          </div>
        </div>

        {/* Single CTA */}
        <div className="text-center pb-2">
          <button
            onClick={onEnter}
            className="btn-cyber-primary inline-flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-bold"
          >
            <KeyRound className="w-4 h-4" />
            Create Your First Secret
            <ArrowRight className="w-4 h-4" />
          </button>
          <p className="text-[11px] text-slate-500 font-mono mt-3">No account. No tracking. Nothing to configure to get started.</p>
        </div>
        </div>
      </TerminalWindow>
    </div>
  );
};
