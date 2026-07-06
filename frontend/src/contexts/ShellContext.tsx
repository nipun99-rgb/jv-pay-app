import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface ShellData {
  contractName?: string;
  period?: string;
  statusLabel?: string;
  statusTone?: 'neutral' | 'info' | 'warn' | 'success';
}

interface ShellContextValue extends ShellData {
  setShellData: (data: Partial<ShellData>) => void;
  clearShell: () => void;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const [shell, setShell] = useState<ShellData>({
    contractName: undefined,
    period: undefined,
    statusLabel: undefined,
    statusTone: 'neutral',
  });

  const setShellData = useCallback((data: Partial<ShellData>) => {
    setShell((prev) => ({ ...prev, ...data }));
  }, []);

  const clearShell = useCallback(() => {
    setShell({ contractName: undefined, period: undefined, statusLabel: undefined, statusTone: 'neutral' });
  }, []);

  return (
    <ShellContext.Provider value={{ ...shell, setShellData, clearShell }}>
      {children}
    </ShellContext.Provider>
  );
}

export function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell must be used within ShellProvider');
  return ctx;
}
