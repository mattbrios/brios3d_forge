"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, apiFetch } from "@/lib/api";
import type { InventoryMovement } from "@/lib/inventory";
import type { MovementsPage } from "@/lib/stock-items";

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
    return <p>Carregando…</p>;
  }

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

  const { movements } = status;

  return (
    <section className="flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Movimentações</h1>

      {movements.length === 0 ? (
        <p>Nenhuma movimentação registrada.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th>Dono</th>
              <th>Tipo</th>
              <th>Quantidade</th>
              <th>Custo unitário</th>
              <th>Usuário</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((movement) => (
              <tr key={movement.id}>
                {/* Dono único (door 3): a linha é de rolo ou de item, nunca dos dois. */}
                <td>
                  {movement.rollId !== null ? (
                    <Link href={`/inventory/${movement.rollId}`}>Rolo</Link>
                  ) : (
                    <Link href={`/inventory/items/${movement.stockItemId}`}>Item</Link>
                  )}
                </td>
                <td>{movement.type}</td>
                <td>{movement.quantity}</td>
                <td>{movement.unitCostCents !== null ? (movement.unitCostCents / 100).toFixed(2) : "—"}</td>
                <td>{movement.userId}</td>
                <td>{new Date(movement.createdAt).toLocaleString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
