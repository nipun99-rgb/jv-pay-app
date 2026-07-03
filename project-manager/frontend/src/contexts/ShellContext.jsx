import { createContext, useContext, useState, useCallback } from 'react';

const ShellContext = createContext(null);

export function ShellProvider({ children }) {
  const [shell, setShell] = useState({
    contractName: undefined,
    period: undefined,
    statusLabel: undefined,
    statusTone: 'neutral',
  });

  const setShellData = useCallback((data) => {
    setShell(prev => ({ ...prev, ...data }));
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

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell must be used within ShellProvider');
  return ctx;
}
