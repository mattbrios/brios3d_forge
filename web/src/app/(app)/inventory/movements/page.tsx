"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, apiFetch } from "@/lib/api";
import type { InventoryMovement } from "@/lib/inventory";
import type { MovementsPage } from "@/lib/stock-items";
import { MovementBadge } from "@/components/movement-badge";
import { Card } from "@/components/ui/card";
import { EmptyState, Loading, PageError } from "@/components/ui/feedback";

type Status =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; movements: InventoryMovement[] };

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "Não foi possível conectar à API";
}

export default function MovementsPageScreen() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus({ kind: "loading" });
    apiFetch<MovementsPage>("/inventory/movements?pageSize=100")
      .then((page) => {
        if (active) setStatus({ kind: "ready", movements: page.items });
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

  if (status.kind === "error") {
    return <PageError message={status.message} onRetry={retry} />;
  }

  const { movements } = status;

  return (
    <Card title="Movimentações" subtitle="Rolos e itens, mais recentes primeiro">
      {movements.length === 0 ? (
        <EmptyState>Nenhuma movimentação registrada.</EmptyState>
      ) : (
        <div className="bf-table-wrap">
          <table className="bf-table">
            <thead>
              <tr>
                <th>Dono</th>
                <th>Tipo</th>
                <th className="is-num">Quantidade</th>
                <th className="is-num">Custo unitário</th>
                <th>Usuário</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((movement) => (
                <tr key={movement.id}>
                  {/* Dono único (door 3): a linha é de rolo ou de item, nunca dos dois. */}
                  <td data-label="Dono">
                    {movement.rollId !== null ? (
                      <Link href={`/inventory/${movement.rollId}`}>Rolo</Link>
                    ) : (
                      <Link href={`/inventory/items/${movement.stockItemId}`}>Item</Link>
                    )}
                  </td>
                  <td data-label="Tipo">
                    <MovementBadge type={movement.type} />
                  </td>
                  <td data-label="Quantidade" className="is-num">
                    {movement.quantity}
                  </td>
                  <td data-label="Custo unitário" className="is-num">
                    {movement.unitCostCents !== null ? (movement.unitCostCents / 100).toFixed(2) : "—"}
                  </td>
                  <td data-label="Usuário" className="bf-mono" style={{ fontSize: 12 }}>
                    {movement.userId}
                  </td>
                  <td data-label="Data">{new Date(movement.createdAt).toLocaleString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
