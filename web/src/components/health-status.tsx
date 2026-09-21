"use client";

import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";

type State =
  | { kind: "loading" }
  | { kind: "ok" }
  | { kind: "error"; message: string };

export function HealthStatus() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    apiFetch<{ status: string }>("/health")
      .then(() => {
        if (active) setState({ kind: "ok" });
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            kind: "error",
            message: error instanceof ApiError ? error.message : "Erro inesperado",
          });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  if (state.kind === "loading") {
    return <p role="status">Verificando a API…</p>;
  }
  if (state.kind === "ok") {
    return (
      <p role="status" className="font-medium text-green-700 dark:text-green-400">
        API ok
      </p>
    );
  }
  return (
    <div role="alert" className="text-red-700 dark:text-red-400">
      <p className="font-medium">API indisponível</p>
      <p className="text-sm">{state.message}</p>
    </div>
  );
}
