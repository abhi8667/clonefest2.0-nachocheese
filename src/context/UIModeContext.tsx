import React, { createContext, useContext, useEffect, useState } from 'react';

export type UIMode = 'simple' | 'technical';

const STORAGE_KEY = 'cipherdrop-ui-mode';

interface UIModeContextValue {
  mode: UIMode;
  setMode: (mode: UIMode) => void;
  /** True when the visitor has not yet picked a mode this browser. */
  isUnset: boolean;
  isSimple: boolean;
  isTechnical: boolean;
}

const UIModeContext = createContext<UIModeContextValue | null>(null);

function readStoredMode(): UIMode | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === 'simple' || raw === 'technical' ? raw : null;
  } catch {
    return null;
  }
}

export const UIModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<UIMode>(() => readStoredMode() ?? 'simple');
  const [isUnset, setIsUnset] = useState<boolean>(() => readStoredMode() === null);

  const setMode = (next: UIMode) => {
    setModeState(next);
    setIsUnset(false);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable (private mode) — mode still applies for this session */
    }
  };

  // Keep the choice consistent across tabs of the same browser.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'simple' || e.newValue === 'technical')) {
        setModeState(e.newValue);
        setIsUnset(false);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return (
    <UIModeContext.Provider
      value={{
        mode,
        setMode,
        isUnset,
        isSimple: mode === 'simple',
        isTechnical: mode === 'technical',
      }}
    >
      {children}
    </UIModeContext.Provider>
  );
};

export function useUIMode(): UIModeContextValue {
  const ctx = useContext(UIModeContext);
  if (!ctx) {
    throw new Error('useUIMode must be used within a UIModeProvider');
  }
  return ctx;
}
