"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

import { ApiError, api, readToken, writeToken } from "./api";
import type { Session, UserProfile } from "./types";

interface AuthState {
  user: UserProfile | null;
  /** True until the stored token has been checked against the server. */
  isLoading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<UserProfile>;
  register: (input: {
    email: string;
    password: string;
    full_name: string;
    phone?: string;
  }) => Promise<UserProfile>;
  signOut: () => void;
  /** Replace the cached profile after a self-service edit. */
  setUser: (user: UserProfile) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  // On first mount, exchange any stored token for a profile. A token that the
  // server rejects is discarded rather than left to fail every later request.
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      if (!readToken()) {
        setIsLoading(false);
        return;
      }

      try {
        const profile = await api.auth.me();
        if (!cancelled) setUserState(profile);
      } catch (error) {
        if (error instanceof ApiError && error.isUnauthorized) {
          writeToken(null);
        }
        // A network error leaves the token in place — the server may just be
        // down, and signing the user out would lose their session needlessly.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const adopt = useCallback(
    (session: Session) => {
      writeToken(session.token);
      setUserState(session.user);
      // Anything cached under the previous identity is now wrong.
      void queryClient.invalidateQueries();
      return session.user;
    },
    [queryClient],
  );

  const signIn = useCallback(
    async (email: string, password: string) =>
      adopt(await api.auth.login({ email, password })),
    [adopt],
  );

  const register = useCallback(
    async (input: {
      email: string;
      password: string;
      full_name: string;
      phone?: string;
    }) => adopt(await api.auth.register(input)),
    [adopt],
  );

  const signOut = useCallback(() => {
    writeToken(null);
    setUserState(null);
    // Clear rather than invalidate: another user's bookings must not sit in the
    // cache waiting to be re-shown.
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      isLoading,
      isAdmin: user?.role === "admin",
      signIn,
      register,
      signOut,
      setUser: setUserState,
    }),
    [user, isLoading, signIn, register, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return context;
}
