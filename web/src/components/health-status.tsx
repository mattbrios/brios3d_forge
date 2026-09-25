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
    return (
      <p role="status" className="bf-health bf-health--loading" style={{ margin: 0 }}>
        <span className="bf-health__dot" />
        Verificando a API…
      </p>
    );
  }
  if (state.kind === "ok") {
    return (
      <p role="status" className="bf-health bf-health--ok" style={{ margin: 0 }}>
        <span className="bf-health__dot" />
        API ok
      </p>
    );
  }
  return (
    <div role="alert" className="bf-health bf-health--error">
      <span className="bf-health__dot" />
      <span>API indisponível</span>
      <span aria-hidden="true">·</span>
      <span style={{ fontWeight: 500 }}>{state.message}</span>
    </div>
  );
}
