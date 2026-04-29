"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { authApi, UserResponse } from "@/lib/api";

type AuthContextValue = {
  user: UserResponse | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: UserResponse) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "tp_token";
const TOKEN_COOKIE = "tp_token";

function syncTokenCookie(token: string | null) {
  if (token) {
    document.cookie = `${TOKEN_COOKIE}=${token}; path=/; SameSite=Strict; max-age=86400`;
  } else {
    document.cookie = `${TOKEN_COOKIE}=; path=/; SameSite=Strict; max-age=0`;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (!saved) {
      syncTokenCookie(null);
      setIsLoading(false);
      return;
    }
    authApi
      .getMe(saved)
      .then((u) => {
        setToken(saved);
        setUser(u);
        syncTokenCookie(saved);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        syncTokenCookie(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback((t: string, u: UserResponse) => {
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
    setUser(u);
    syncTokenCookie(t);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    syncTokenCookie(null);
    setToken(null);
    setUser(null);
    router.push("/signin");
  }, [router]);

  const refreshUser = useCallback(async () => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (!t) return;
    try {
      const u = await authApi.getMe(t);
      setUser(u);
    } catch {
      logout();
    }
  }, [logout]);

  const value = useMemo(
    () => ({ user, token, isLoading, login, logout, refreshUser }),
    [user, token, isLoading, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
