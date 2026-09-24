"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { type StockAlert, type StockAlertsResponse, stockHrefOf } from "@/lib/alerts";
import { ApiError, apiFetch } from "@/lib/api";

type Status =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; alerts: StockAlert[] };

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "Não foi possível conectar à API";
}

// Tela só de leitura, para os três papéis (AC 29): o que ela mostra não depende de quem olha.
export default function StockAlertsPage() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    // Mesmo padrão de fetch-em-efeito das telas das Fases 6-10.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus({ kind: "loading" });
    apiFetch<StockAlertsResponse>("/inventory/alerts")
      .then((response) => {
        if (active) setStatus({ kind: "ready", alerts: response.items });
      })
      .catch((error: unknown) => {
        if (active) setStatus({ kind: "error", message: messageOf(error) });
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  function retry() {
    setAttempt((current) => current + 1);
  }

  if (status.kind === "loading") {
    return <p>Carregando…</p>;
  }

  // Erro não mostra tabela pela metade: ou a lista inteira, ou o erro.
  if (status.kind === "error") {
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="alert">{status.message}</p>
        <button
          type="button"
          onClick={retry}
          className="rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const { alerts } = status;

  return (
    <section className="flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Abaixo do mínimo</h1>

      {alerts.length === 0 ? (
        <p>Nenhum item está abaixo do mínimo.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th>Item</th>
              <th>Saldo</th>
              <th>Mínimo</th>
              <th>Unidade</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert) => (
              <tr key={`${alert.kind}-${alert.id}`}>
                <td>
                  <Link href={stockHrefOf(alert)}>{alert.label}</Link>
                </td>
                <td>{alert.balance}</td>
                <td>{alert.minimum}</td>
                <td>{alert.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
