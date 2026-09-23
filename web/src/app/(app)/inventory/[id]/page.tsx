"use client";

import { type FormEvent, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/crud/confirm-dialog";
import { ApiError, apiFetch } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import type { RollDetail } from "@/lib/inventory";
import type { Material, MaterialsPage } from "@/lib/materials";

type Status =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; role: AuthUser["role"]; roll: RollDetail; materials: Material[] };

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "Não foi possível conectar à API";
}

function materialLabel(materials: Material[], materialId: string): string {
  const material = materials.find((candidate) => candidate.id === materialId);
  return material ? `${material.type} · ${material.brand} · ${material.color}` : materialId;
}

// `params` é uma Promise nesta versão do Next.js (breaking change): resolvida aqui num efeito,
// em vez de `use()`, para não depender de um Suspense boundary fora do controle desta página.
export default function RollDetailPage({ params }: { params: Promise<{ id: string }> }) {
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
  return <RollDetailContent id={id} />;
}

function RollDetailContent({ id }: { id: string }) {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  const [grossWeightGrams, setGrossWeightGrams] = useState("");
  const [weighSubmitting, setWeighSubmitting] = useState(false);
  const [weighError, setWeighError] = useState<string | null>(null);

  const [movementType, setMovementType] = useState<"consumo" | "perda">("consumo");
  const [movementQuantity, setMovementQuantity] = useState("");
  const [movementReason, setMovementReason] = useState("");
  const [movementSubmitting, setMovementSubmitting] = useState(false);
  const [movementError, setMovementError] = useState<string | null>(null);

  const [openSubmitting, setOpenSubmitting] = useState(false);
  const [drySubmitting, setDrySubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  useEffect(() => {
    let active = true;
    // Mesmo padrão de fetch-em-efeito de materials/page.tsx (volta para "loading" ao repetir
    // a busca via retry); o lint só reclama aqui porque este componente é menor e o React
    // Compiler consegue analisá-lo por inteiro.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus({ kind: "loading" });
    Promise.all([
      apiFetch<AuthUser>("/auth/me"),
      apiFetch<RollDetail>(`/inventory/rolls/${id}`),
      apiFetch<MaterialsPage>("/materials?pageSize=100"),
    ])
      .then(([me, roll, materials]) => {
        if (active) setStatus({ kind: "ready", role: me.role, roll, materials: materials.items });
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

  async function submitWeigh(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWeighSubmitting(true);
    setWeighError(null);
    try {
      await apiFetch(`/inventory/rolls/${id}/weigh`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grossWeightGrams: Number(grossWeightGrams) }),
      });
      setGrossWeightGrams("");
      retry();
    } catch (error) {
      setWeighError(messageOf(error));
    } finally {
      setWeighSubmitting(false);
    }
  }

  async function submitMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMovementSubmitting(true);
    setMovementError(null);
    try {
      await apiFetch(`/inventory/rolls/${id}/movements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: movementType,
          quantityGrams: Number(movementQuantity),
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

  async function submitOpen() {
    setOpenSubmitting(true);
    setActionError(null);
    try {
      await apiFetch(`/inventory/rolls/${id}/open`, { method: "PATCH" });
      retry();
    } catch (error) {
      setActionError(messageOf(error));
    } finally {
      setOpenSubmitting(false);
    }
  }

  async function submitDry() {
    setDrySubmitting(true);
    setActionError(null);
    try {
      await apiFetch(`/inventory/rolls/${id}/dry`, { method: "PATCH" });
      retry();
    } catch (error) {
      setActionError(messageOf(error));
    } finally {
      setDrySubmitting(false);
    }
  }

  async function confirmDiscard() {
    setDiscarding(true);
    try {
      await apiFetch(`/inventory/rolls/${id}/discard`, { method: "PATCH" });
      setConfirmingDiscard(false);
      retry();
    } catch (error) {
      setActionError(messageOf(error));
      setConfirmingDiscard(false);
    } finally {
      setDiscarding(false);
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

  const { role, roll, materials } = status;
  const editable = role === "admin" || role === "production";
  const discarded = roll.status === "descartado";

  return (
    <section className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{materialLabel(materials, roll.materialId)}</h1>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt>Status</dt>
        <dd>{roll.status}</dd>
        <dt>Saldo</dt>
        <dd>{roll.balanceGrams} g</dd>
        <dt>Tara do carretel</dt>
        <dd>{roll.spoolTareGrams} g</dd>
        <dt>Peso inicial</dt>
        <dd>{roll.initialWeightGrams} g</dd>
      </dl>

      {actionError && <p role="alert">{actionError}</p>}

      {editable && !discarded && (
        <div className="flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">Pesagem</h2>
          <form onSubmit={submitWeigh} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Peso bruto na balança (g)
              <input
                type="number"
                value={grossWeightGrams}
                onChange={(event) => setGrossWeightGrams(event.target.value)}
                required
              />
            </label>
            {weighError && <p role="alert">{weighError}</p>}
            <button type="submit" disabled={weighSubmitting}>
              {weighSubmitting ? "Salvando…" : "Pesar"}
            </button>
          </form>
        </div>
      )}

      {editable && !discarded && (
        <div className="flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">Baixa</h2>
          <form onSubmit={submitMovement} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Tipo
              <select value={movementType} onChange={(event) => setMovementType(event.target.value as "consumo" | "perda")}>
                <option value="consumo">Consumo</option>
                <option value="perda">Perda</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Gramas
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

      {editable && (
        <div className="flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">Abertura e secagem</h2>
          <div className="flex gap-2">
            <button type="button" onClick={() => void submitOpen()} disabled={openSubmitting || roll.openedAt !== null}>
              {roll.openedAt !== null ? "Já aberto" : "Abrir rolo"}
            </button>
            <button type="button" onClick={() => void submitDry()} disabled={drySubmitting}>
              Registrar secagem
            </button>
          </div>
        </div>
      )}

      {editable && !discarded && (
        <div className="flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <button type="button" onClick={() => setConfirmingDiscard(true)}>
            Descartar
          </button>
        </div>
      )}

      {confirmingDiscard && (
        <ConfirmDialog
          message={`Descartar este rolo? O saldo restante (${roll.balanceGrams} g) vira perda.`}
          confirmLabel="Descartar"
          onConfirm={() => void confirmDiscard()}
          onCancel={() => setConfirmingDiscard(false)}
          pending={discarding}
        />
      )}

      <div className="flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Histórico</h2>
        {roll.movements.length === 0 ? (
          <p>Nenhuma movimentação.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th>Tipo</th>
                <th>Gramas</th>
                <th>Custo (R$/g)</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {roll.movements.map((movement) => (
                <tr key={movement.id}>
                  <td>{movement.type}</td>
                  <td>{movement.quantityGrams}</td>
                  <td>{movement.unitCostCentsPerGram !== null ? (movement.unitCostCentsPerGram / 100).toFixed(2) : "—"}</td>
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
