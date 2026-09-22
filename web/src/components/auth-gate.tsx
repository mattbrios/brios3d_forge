"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ApiError, UNAUTHORIZED_EVENT, apiFetch } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import { AppShell } from "./app-shell";

type GateState =
  | { status: "loading" }
  | { status: "unauthorized" }
  | { status: "error"; message: string }
  | { status: "ready"; user: AuthUser };

// Confere a sessão pelo GET /auth/me antes de mostrar qualquer página protegida.
export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<GateState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch<AuthUser>("/auth/me")
      .then((user) => {
        if (active) setState({ status: "ready", user });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          setState({ status: "unauthorized" });
          return;
        }
        setState({
          status: "error",
          message: error instanceof ApiError ? error.message : "Não foi possível conectar à API",
        });
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  // Um 401 em qualquer chamada da página (sessão expirada) também volta para o login.
  useEffect(() => {
    const onUnauthorized = () => setState({ status: "unauthorized" });
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  useEffect(() => {
    if (state.status === "unauthorized") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [state.status, router, pathname]);

  function retry() {
    setState({ status: "loading" });
    setAttempt((current) => current + 1);
  }

  async function signOut() {
    setSignOutError(null);
    try {
      await apiFetch<null>("/auth/logout", { method: "POST" });
      router.replace("/login");
    } catch {
      setSignOutError("Não foi possível sair. Tente novamente");
    }
  }

  if (state.status === "error") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
        <p role="alert">{state.message}</p>
        <button
          type="button"
          onClick={retry}
          className="rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
        >
          Tentar novamente
        </button>
      </main>
    );
  }

  if (state.status !== "ready") {
    return <p className="p-6">Carregando…</p>;
  }

  return (
    <AppShell
      account={
        <div className="flex items-center gap-3 text-sm">
          {signOutError && (
            <span role="alert" className="text-red-700 dark:text-red-400">
              {signOutError}
            </span>
          )}
          <span>{state.user.name}</span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded border border-zinc-300 px-2 py-0.5 dark:border-zinc-700"
          >
            Sair
          </button>
        </div>
      }
    >
      {children}
    </AppShell>
  );
}
