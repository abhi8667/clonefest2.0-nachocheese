import React from 'react';

interface TerminalWindowProps {
  /** Shown centered in the title bar, e.g. "cipherdrop --new-secret" */
  path: string;
  accent?: 'emerald' | 'amber' | 'rose';
  glow?: boolean;
  className?: string;
  bodyClassName?: string;
  /** Stagger index (1-4) so a group of windows resolves in sequence on mount. */
  stagger?: 1 | 2 | 3 | 4;
  children: React.ReactNode;
}

const ACCENT_BORDER: Record<NonNullable<TerminalWindowProps['accent']>, string> = {
  emerald: 'border-emerald-500/20',
  amber: 'border-amber-500/30',
  rose: 'border-rose-500/30',
};

/**
 * Reusable terminal-window chrome (traffic lights + title bar) used to give
 * every major panel in the app the same identity as the boot-sequence
 * landing page, instead of introducing a second visual language.
 */
export const TerminalWindow: React.FC<TerminalWindowProps> = ({
  path,
  accent = 'emerald',
  glow = false,
  className = '',
  bodyClassName = '',
  stagger,
  children,
}) => {
  return (
    <div
      className={`terminal-window animate-panel-in ${stagger ? `stagger-${stagger}` : ''} ${glow ? 'glass-panel-glow' : 'glass-panel'} rounded-2xl overflow-hidden border ${ACCENT_BORDER[accent]} ${className}`}
    >
      {/* Title bar. The traffic lights and the right-hand spacer are the same
          width, which is what keeps the centered path optically centered. */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-obsidian-950/90 border-b border-white/5">
        <div className="flex items-center gap-1.5 flex-shrink-0 w-[52px]">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500/70"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70"></span>
        </div>
        <span className="flex-1 min-w-0 text-center text-[11px] font-mono text-slate-500 truncate px-2">
          {path}
        </span>
        <div className="w-[52px] flex-shrink-0" aria-hidden="true" />
      </div>
      <div className={bodyClassName}>{children}</div>
    </div>
  );
};
