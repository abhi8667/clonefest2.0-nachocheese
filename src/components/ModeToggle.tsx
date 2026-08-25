import React from 'react';
import { Compass, Terminal } from 'lucide-react';

interface ModeToggleProps {
  mode: 'guided' | 'operator';
  setMode: (mode: 'guided' | 'operator') => void;
}

export function ModeToggle({ mode, setMode }: ModeToggleProps) {
  return (
    <div className="relative flex items-center p-1 rounded-xl border border-white/10 bg-[#11191c]/80 backdrop-blur-xl shadow-[0_0_30px_rgba(0,107,180,0.08)]">
      
      {/* Sliding indicator */}
      <div
        className={`
          absolute top-1 bottom-1 w-[calc(50%-4px)]
          rounded-lg
          bg-gradient-to-r from-[#006BB4] to-[#DE443B]
          opacity-90
          transition-all duration-300 ease-out
          shadow-[0_0_20px_rgba(0,107,180,0.25)]
          ${mode === 'guided' ? 'left-1' : 'left-[calc(50%+1px)]'}
        `}
      />

      <button
        onClick={() => setMode('guided')}
        className={`
          relative z-10 flex items-center gap-2
          px-4 py-2 rounded-lg
          text-xs font-semibold tracking-wide
          transition-colors duration-300
          ${mode === 'guided'
            ? 'text-white'
            : 'text-slate-500 hover:text-slate-300'}
        `}
      >
        <Compass size={15} />
        <span>Guided</span>
      </button>

      <button
        onClick={() => setMode('operator')}
        className={`
          relative z-10 flex items-center gap-2
          px-4 py-2 rounded-lg
          text-xs font-semibold tracking-wide
          transition-colors duration-300
          ${mode === 'operator'
            ? 'text-white'
            : 'text-slate-500 hover:text-slate-300'}
        `}
      >
        <Terminal size={15} />
        <span>Operator</span>
      </button>
    </div>
  );
}