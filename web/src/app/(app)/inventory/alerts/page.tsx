"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { type StockAlert, type StockAlertsResponse, stockHrefOf } from "@/lib/alerts";
import { ApiError, apiFetch } from "@/lib/api";
import { TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StockMeter } from "@/components/ui/data";
import { EmptyState, Loading, PageError } from "@/components/ui/feedback";

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
    return <Loading />;
  }

  // Erro não mostra tabela pela metade: ou a lista inteira, ou o erro.
  if (status.kind === "error") {
    return <PageError message={status.message} onRetry={retry} />;
  }

  const { alerts } = status;

  return (
    <Card
      title={`${alerts.length} ${alerts.length === 1 ? "item" : "itens"} abaixo do mínimo`}
      icon={TriangleAlert}
      subtitle="Filamento soma todos os rolos do material"
    >
      {alerts.length === 0 ? (
        <EmptyState>Nenhum item está abaixo do mínimo.</EmptyState>
      ) : (
        <div className="bf-table-wrap">
          <table className="bf-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Saldo</th>
                <th className="is-num">Mínimo</th>
                <th>Unidade</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr key={`${alert.kind}-${alert.id}`}>
                  <td data-label="Item">
                    <Link href={stockHrefOf(alert)}>{alert.label}</Link>
                  </td>
                  <td data-label="Saldo">
                    <div className="flex flex-col gap-1.5" style={{ minWidth: 140 }}>
                      <StockMeter value={alert.balance} max={alert.minimum * 1.5} minimum={alert.minimum} />
                      <span className="bf-meter__text">{alert.balance}</span>
                    </div>
                  </td>
                  <td data-label="Mínimo" className="is-num">
                    {alert.minimum}
                  </td>
                  <td data-label="Unidade">{alert.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
