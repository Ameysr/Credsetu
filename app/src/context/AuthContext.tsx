import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError, api, setAuthToken } from '../api/client';
import type { AuthSession, User } from '../api/types';
import { clearToken, loadToken, saveToken } from '../storage/token-storage';

interface AuthContextValue {
  user: User | null;
  /** True while the stored session is being checked on launch. */
  isRestoring: boolean;
  signIn: (session: AuthSession) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  // On launch, reuse a stored token if it still works. That is what makes the
  // app skip the login screen on a second open.
  useEffect(() => {
    let cancelled = false;

    async function restore(): Promise<void> {
      try {
        const token = await loadToken();
        if (!token) return;

        setAuthToken(token);
        const response = await api.me();
        if (!cancelled) setUser(response.user);
      } catch (error) {
        // An expired or revoked token is worse than none — discard it. A
        // network failure leaves it alone so the next launch can retry.
        if (error instanceof ApiError && error.isUnauthorized) {
          setAuthToken(null);
          await clearToken();
        }
      } finally {
        if (!cancelled) setIsRestoring(false);
      }
    }

    void restore();

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (session: AuthSession) => {
    setAuthToken(session.token);
    await saveToken(session.token);
    setUser(session.user);
  }, []);

  const signOut = useCallback(async () => {
    setAuthToken(null);
    await clearToken();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isRestoring, signIn, signOut }),
    [user, isRestoring, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}
