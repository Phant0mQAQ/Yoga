import * as SecureStore from "expo-secure-store";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  isUnauthorizedError,
  login as loginRequest,
  logout as logoutRequest,
  me,
  setAuthToken,
  setUnauthorizedHandler
} from "@/api/client";
import type { Role, User } from "@/api/types";
import i18n from "@/i18n";

type SessionState = {
  token: string | null;
  user: User | null;
  role: Role | null;
  locale: string;
  ready: boolean;
  hydrationError: string | null;
  retryHydration: () => Promise<void>;
  setLocale: (locale: string) => Promise<void>;
  login: (email: string, password: string, role: Role) => Promise<void>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [locale, setLocaleState] = useState("en");
  const [ready, setReady] = useState(false);
  const [hydrationError, setHydrationError] = useState<string | null>(null);
  const clearingSession = useRef<Promise<void> | null>(null);

  const clearLocalSession = useCallback(() => {
    if (clearingSession.current) return clearingSession.current;

    setAuthToken(null);
    setToken(null);
    setUser(null);
    setRole(null);
    setHydrationError(null);

    clearingSession.current = (async () => {
      try {
        await queryClient.cancelQueries();
      } finally {
        setTimeout(() => queryClient.clear(), 0);
      }
      try {
        await SecureStore.deleteItemAsync("token");
      } catch {
        // In-memory auth is already cleared, so storage cleanup must not block logout.
      }
    })().finally(() => {
      clearingSession.current = null;
    });

    return clearingSession.current;
  }, [queryClient]);

  useEffect(() => {
    void hydrate();
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clearLocalSession);
    return () => setUnauthorizedHandler(null);
  }, [clearLocalSession]);

  async function hydrate() {
    setReady(false);
    setHydrationError(null);
    try {
      const storedToken = await SecureStore.getItemAsync("token");
      if (storedToken) {
        setAuthToken(storedToken);
        setToken(storedToken);
      }
      const storedLocale = await SecureStore.getItemAsync("locale");
      if (storedLocale) {
        setLocaleState(storedLocale);
        await i18n.changeLanguage(storedLocale);
      }
      if (storedToken) {
        try {
          const response = await me();
          setUser(response.user);
          setRole(response.activeRole);
        } catch (error) {
          if (isUnauthorizedError(error)) {
            await clearLocalSession();
          } else {
            setHydrationError(errorMessage(error));
          }
        }
      }
    } catch (error) {
      setHydrationError(errorMessage(error));
    } finally {
      setReady(true);
    }
  }

  async function login(email: string, password: string, nextRole: Role) {
    const response = await loginRequest(email, password, nextRole, locale);
    queryClient.clear();
    setAuthToken(response.token);
    setToken(response.token);
    setUser(response.user);
    setRole(response.session.activeRole);
    setHydrationError(null);
    try {
      await SecureStore.setItemAsync("token", response.token);
    } catch {
      // The authenticated session remains usable even if persistence is unavailable.
    }
  }

  async function logout() {
    const revokeSession = token
      ? logoutRequest().catch(() => ({ ok: false }))
      : Promise.resolve({ ok: true });

    await Promise.allSettled([clearLocalSession(), revokeSession]);
  }

  async function setLocale(nextLocale: string) {
    setLocaleState(nextLocale);
    await i18n.changeLanguage(nextLocale);
    try {
      await SecureStore.setItemAsync("locale", nextLocale);
    } catch {
      // The selected locale remains active for the current app session.
    }
  }

  const value = useMemo(() => ({
    token,
    user,
    role,
    locale,
    ready,
    hydrationError,
    retryHydration: hydrate,
    setLocale,
    login,
    logout
  }), [token, user, role, locale, ready, hydrationError]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to restore your session.";
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
