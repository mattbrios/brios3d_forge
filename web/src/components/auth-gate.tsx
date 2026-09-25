"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ApiError, UNAUTHORIZED_EVENT, apiFetch } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import { LogOut } from "lucide-react";
import { AlertsIndicator } from "./alerts-indicator";
import { AppShell } from "./app-shell";
import { IconButton } from "./ui/button";
import { Avatar } from "./ui/data";
import { Loading, PageError } from "./ui/feedback";

const ROLE_LABELS: Record<AuthUser["role"], string> = {
  admin: "Administrador",
  production: "Produção",
  sales: "Vendas",
};

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
      <main className="flex flex-1 items-center justify-center p-6">
        <PageError message={state.message} onRetry={retry} />
      </main>
    );
  }

  if (state.status !== "ready") {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Loading />
      </div>
    );
  }

  return (
    <AppShell
      role={state.user.role}
      // O indicador busca os alertas por conta própria: uma falha nele não pode atrasar nem
      // derrubar a tela que o usuário foi ver (AC 28).
      alerts={<AlertsIndicator />}
      account={
        <div className="bf-topbar__account">
          {signOutError && (
            <span role="alert" className="bf-topbar__account-error">
              {signOutError}
            </span>
          )}
          <Avatar name={state.user.name} />
          <span className="bf-topbar__user-text">
            <span className="bf-topbar__name">{state.user.name}</span>
            <span className="bf-topbar__role">{ROLE_LABELS[state.user.role]}</span>
          </span>
          <IconButton icon={LogOut} label="Sair" onClick={() => void signOut()} />
        </div>
      }
    >
      {children}
    </AppShell>
  );
}
