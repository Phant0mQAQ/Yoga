import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  isUnauthorizedError,
  login as loginRequest,
  logout as logoutRequest,
  me,
  register as registerRequest,
  resendEmailVerification as resendEmailVerificationRequest,
  setAuthToken,
  setFirebaseRefreshToken,
  setUnauthorizedHandler
} from "@/api/client";
import type { RegistrationStartResponse, Role, User } from "@/api/types";
import i18n from "@/i18n";
import { deleteSessionValue, getSessionValue, setSessionValue } from "@/state/session-storage";

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
  register: (
    name: string,
    email: string,
    password: string,
    role: Role,
    inviteCode?: string
  ) => Promise<RegistrationStartResponse>;
  verifyEmail: (email: string, password: string, role: Role) => Promise<void>;
  resendEmailVerification: (email: string, password: string) => Promise<RegistrationStartResponse>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

function resolveInitialLocale(language = i18n.resolvedLanguage ?? i18n.language): "en" | "zh-Hans" | "ko" {
  if (language?.startsWith("ko")) return "ko";
  if (language?.startsWith("zh")) return "zh-Hans";
  return "en";
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [locale, setLocaleState] = useState<string>(resolveInitialLocale);
  const [ready, setReady] = useState(false);
  const [hydrationError, setHydrationError] = useState<string | null>(null);
  const clearingSession = useRef<Promise<void> | null>(null);

  const clearLocalSession = useCallback(() => {
    if (clearingSession.current) return clearingSession.current;

    setAuthToken(null);
    setFirebaseRefreshToken(null);
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
        await Promise.all([
          deleteSessionValue("token"),
          deleteSessionValue("firebaseRefreshToken")
        ]);
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
      const storedToken = await getSessionValue("token");
      const storedFirebaseRefreshToken = await getSessionValue("firebaseRefreshToken");
      if (storedToken) {
        setAuthToken(storedToken);
        setToken(storedToken);
      }
      if (storedFirebaseRefreshToken) setFirebaseRefreshToken(storedFirebaseRefreshToken);
      const storedLocale = await getSessionValue("locale");
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

  async function applyAuthResponse(response: Awaited<ReturnType<typeof loginRequest>>) {
    queryClient.clear();
    setAuthToken(response.token);
    setFirebaseRefreshToken(response.firebase?.refreshToken ?? null);
    setToken(response.token);
    setUser(response.user);
    setRole(response.session.activeRole);
    setHydrationError(null);
    try {
      await setSessionValue("token", response.token);
      if (response.firebase?.refreshToken) {
        await setSessionValue("firebaseRefreshToken", response.firebase.refreshToken);
      } else {
        await deleteSessionValue("firebaseRefreshToken");
      }
    } catch {
      // The authenticated session remains usable even if persistence is unavailable.
    }
  }

  async function login(email: string, password: string, nextRole: Role) {
    await applyAuthResponse(await loginRequest(email, password, nextRole, locale));
  }

  async function register(name: string, email: string, password: string, nextRole: Role, inviteCode?: string) {
    return registerRequest(name, email, password, nextRole, locale, inviteCode);
  }

  async function verifyEmail(email: string, password: string, nextRole: Role) {
    await applyAuthResponse(await loginRequest(email, password, nextRole, locale));
  }

  async function resendEmailVerification(email: string, password: string) {
    return resendEmailVerificationRequest(email, password, locale);
  }

  async function refreshUser() {
    const response = await me();
    setUser(response.user);
    setRole(response.activeRole);
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
      await setSessionValue("locale", nextLocale);
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
    register,
    verifyEmail,
    resendEmailVerification,
    refreshUser,
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
