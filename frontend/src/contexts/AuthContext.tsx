import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiFetch } from '@/lib/api';

interface User {
  id: string;
  displayName: string;
  email: string;
  roles?: Array<{ code: string } | string>;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/auth/me')
      .then((data) => {
        const typed = data as { user?: User } | null;
        setUser(typed?.user ?? null);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }) as { user: User };
    setUser(data.user);
    return data.user;
  };

  const logout = async (): Promise<void> => {
    await apiFetch('/auth/logout', { method: 'POST' });
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
