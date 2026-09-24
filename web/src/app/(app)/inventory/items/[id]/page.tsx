"use client";

import { type FormEvent, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/crud/confirm-dialog";
import { ApiError, apiFetch } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import type { Printer, PrintersPage } from "@/lib/printers";
import { CATEGORY_LABELS, formatAvgCost, type StockItemDetail } from "@/lib/stock-items";

type Status =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; role: AuthUser["role"]; item: StockItemDetail; printers: Printer[] };

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "Não foi possível conectar à API";
}

function printerLabel(printers: Printer[], printerId: string): string {
  return printers.find((printer) => printer.id === printerId)?.name ?? printerId;
}

// `params` é uma Promise nesta versão do Next.js (breaking change): resolvida aqui num efeito,
// como no detalhe do rolo, para não depender de um Suspense boundary fora desta página.
export default function StockItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    params.then((resolved) => {
      if (active) setId(resolved.id);
    });
    return () => {
      active = false;
    };
  }, [params]);

  if (id === null) {
    return <p>Carregando…</p>;
  }
  return <StockItemDetailContent id={id} />;
}

function StockItemDetailContent({ id }: { id: string }) {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  const [movementType, setMovementType] = useState<"consumo" | "perda">("consumo");
  const [movementQuantity, setMovementQuantity] = useState("");
  const [movementReason, setMovementReason] = useState("");
  const [movementSubmitting, setMovementSubmitting] = useState(false);
  const [movementError, setMovementError] = useState<string | null>(null);

  const [countedQuantity, setCountedQuantity] = useState("");
  const [countSubmitting, setCountSubmitting] = useState(false);
  const [countError, setCountError] = useState<string | null>(null);

  // Fase 11: o cadastro do item (Fase 10) tem formulário só de criação, então sem isto um item já
  // cadastrado nunca poderia ganhar um piso pela interface.
  const [minimumQuantity, setMinimumQuantity] = useState<string | null>(null);
  const [minimumSubmitting, setMinimumSubmitting] = useState(false);
  const [minimumError, setMinimumError] = useState<string | null>(null);

  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus({ kind: "loading" });
    Promise.all([
      apiFetch<AuthUser>("/auth/me"),
      apiFetch<StockItemDetail>(`/inventory/items/${id}`),
      apiFetch<PrintersPage>("/printers?pageSize=100"),
    ])
      .then(([me, item, printers]) => {
        if (!active) return;
        setStatus({ kind: "ready", role: me.role, item, printers: printers.items });
        setMinimumQuantity(item.minimumQuantity === null ? "" : String(item.minimumQuantity));
      })
      .catch((error: unknown) => {
        if (active) setStatus({ kind: "error", message: messageOf(error) });
      });
    return () => {
      active = false;
    };
  }, [id, attempt]);

  function retry() {
    setAttempt((current) => current + 1);
  }

  async function submitMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMovementSubmitting(true);
    setMovementError(null);
    try {
      await apiFetch(`/inventory/items/${id}/movements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: movementType,
          quantity: Number(movementQuantity),
          reason: movementReason || undefined,
        }),
      });
      setMovementQuantity("");
      setMovementReason("");
      retry();
    } catch (error) {
      setMovementError(messageOf(error));
    } finally {
      setMovementSubmitting(false);
    }
  }

  async function submitCount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCountSubmitting(true);
    setCountError(null);
    try {
      await apiFetch(`/inventory/items/${id}/count`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countedQuantity: Number(countedQuantity) }),
      });
      setCountedQuantity("");
      retry();
    } catch (error) {
      setCountError(messageOf(error));
    } finally {
      setCountSubmitting(false);
    }
  }

  async function submitMinimum(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMinimumSubmitting(true);
    setMinimumError(null);
    try {
      await apiFetch(`/inventory/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Campo vazio é "sem mínimo": `null` explícito limpa a política.
        body: JSON.stringify({
          minimumQuantity: minimumQuantity === "" ? null : Number(minimumQuantity),
        }),
      });
      retry();
    } catch (error) {
      setMinimumError(messageOf(error));
    } finally {
      setMinimumSubmitting(false);
    }
  }

  async function confirmDeactivate() {
    setDeactivating(true);
    try {
      await apiFetch(`/inventory/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false }),
      });
      setConfirmingDeactivate(false);
      retry();
    } catch (error) {
      setActionError(messageOf(error));
      setConfirmingDeactivate(false);
    } finally {
      setDeactivating(false);
    }
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

  const { role, item, printers } = status;
  // Consumo, perda e contagem são ação de chão de fábrica (AC 45): vendas só lê.
  const operational = role === "admin" || role === "production";
  const canDeactivate = role === "admin" && item.active;

  return (
    <section className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{item.name}</h1>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt>Categoria</dt>
        <dd>{CATEGORY_LABELS[item.category]}</dd>
        <dt>Saldo</dt>
        <dd>
          {item.balanceQuantity} {item.unitOfMeasure}
        </dd>
        <dt>Estoque mínimo</dt>
        <dd>
          {item.minimumQuantity === null ? "—" : `${item.minimumQuantity} ${item.unitOfMeasure}`}
        </dd>
        <dt>Custo médio</dt>
        <dd>{formatAvgCost(item.avgCostCents, item.unitOfMeasure)}</dd>
        <dt>SKU</dt>
        <dd>{item.sku ?? "—"}</dd>
        <dt>Localização</dt>
        <dd>{item.location ?? "—"}</dd>
        <dt>Situação</dt>
        <dd>{item.active ? "Ativo" : "Inativo"}</dd>
      </dl>

      {item.category === "peca_reposicao" && (
        <div className="flex flex-col gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">Impressoras compatíveis</h2>
          {item.compatiblePrinterIds.length === 0 ? (
            <p>Nenhuma impressora vinculada.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {item.compatiblePrinterIds.map((printerId) => (
                <li key={printerId}>{printerLabel(printers, printerId)}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {actionError && <p role="alert">{actionError}</p>}

      {role === "admin" && (
        <div className="flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">Estoque mínimo</h2>
          <form onSubmit={submitMinimum} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Mínimo ({item.unitOfMeasure}), vazio para nenhum
              <input
                type="number"
                value={minimumQuantity ?? ""}
                onChange={(event) => setMinimumQuantity(event.target.value)}
              />
            </label>
            {minimumError && <p role="alert">{minimumError}</p>}
            <button type="submit" disabled={minimumSubmitting}>
              {minimumSubmitting ? "Salvando…" : "Salvar mínimo"}
            </button>
          </form>
        </div>
      )}

      {operational && (
        <div className="flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">Baixa</h2>
          <form onSubmit={submitMovement} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Tipo
              <select
                value={movementType}
                onChange={(event) => setMovementType(event.target.value as "consumo" | "perda")}
              >
                <option value="consumo">Consumo</option>
                <option value="perda">Perda</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Quantidade ({item.unitOfMeasure})
              <input
                type="number"
                value={movementQuantity}
                onChange={(event) => setMovementQuantity(event.target.value)}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Motivo
              <input value={movementReason} onChange={(event) => setMovementReason(event.target.value)} />
            </label>
            {movementError && <p role="alert">{movementError}</p>}
            <button type="submit" disabled={movementSubmitting}>
              {movementSubmitting ? "Salvando…" : "Dar baixa"}
            </button>
          </form>
        </div>
      )}

      {operational && (
        <div className="flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">Contagem de inventário</h2>
          <form onSubmit={submitCount} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Quantidade contada ({item.unitOfMeasure})
              <input
                type="number"
                value={countedQuantity}
                onChange={(event) => setCountedQuantity(event.target.value)}
                required
              />
            </label>
            {countError && <p role="alert">{countError}</p>}
            <button type="submit" disabled={countSubmitting}>
              {countSubmitting ? "Salvando…" : "Registrar contagem"}
            </button>
          </form>
        </div>
      )}

      {canDeactivate && (
        <div className="flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <button type="button" onClick={() => setConfirmingDeactivate(true)}>
            Desativar
          </button>
        </div>
      )}

      {confirmingDeactivate && (
        <ConfirmDialog
          message={`Desativar "${item.name}"? O histórico e o saldo continuam, mas o item não aceita mais entrada.`}
          confirmLabel="Desativar"
          onConfirm={() => void confirmDeactivate()}
          onCancel={() => setConfirmingDeactivate(false)}
          pending={deactivating}
        />
      )}

      <div className="flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Histórico</h2>
        {item.movements.length === 0 ? (
          <p>Nenhuma movimentação.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th>Tipo</th>
                <th>Quantidade</th>
                <th>Custo unitário</th>
                <th>Motivo</th>
                <th>Usuário</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {item.movements.map((movement) => (
                <tr key={movement.id}>
                  <td>{movement.type}</td>
                  <td>{movement.quantity}</td>
                  <td>{movement.unitCostCents !== null ? (movement.unitCostCents / 100).toFixed(2) : "—"}</td>
                  <td>{movement.reason ?? "—"}</td>
                  <td>{movement.userId}</td>
                  <td>{new Date(movement.createdAt).toLocaleString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
