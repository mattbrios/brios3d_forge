"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/crud/confirm-dialog";
import { ApiError, apiFetch } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import type { RollDetail } from "@/lib/inventory";
import type { Material, MaterialsPage } from "@/lib/materials";
import {
  CircleMinus,
  Droplet,
  History,
  PackageOpen,
  QrCode,
  Thermometer,
  Trash2,
  Weight,
} from "lucide-react";
import { MovementBadge } from "@/components/movement-badge";
import { RollStatusBadge } from "@/components/roll-status-badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StockMeter } from "@/components/ui/data";
import { Alert, EmptyState, Loading, PageError } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/form";

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
    return <Loading />;
  }

  if (status.kind === "error") {
    return <PageError message={status.message} onRetry={retry} />;
  }

  const { role, roll, materials } = status;
  const editable = role === "admin" || role === "production";
  const discarded = roll.status === "descartado";

  return (
    <>
      <nav aria-label="Trilha" className="bf-breadcrumb">
        <Link href="/inventory">Filamento</Link>
        <span aria-hidden="true">/</span>
        <span className="bf-mono">{roll.id.slice(0, 8)}</span>
      </nav>

      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-0" style={{ flex: "1 1 240px" }}>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{materialLabel(materials, roll.materialId)}</h2>
              <RollStatusBadge status={roll.status} />
            </div>
            <p className="bf-muted" style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
              {roll.location ?? "Sem localização"}
              {roll.batch ? ` · lote ${roll.batch}` : ""}
            </p>
          </div>
          {/* Fase 11: o rolo na prateleira ganha um caminho de volta para esta página. */}
          <ButtonLink href={`/inventory/${id}/label`} icon={QrCode}>
            Imprimir etiqueta
          </ButtonLink>
        </div>
        <StockMeter value={roll.balanceGrams} max={roll.initialWeightGrams} minimum={null} />
        <dl className="bf-dl">
          <div>
            <dt>Saldo</dt>
            <dd>{roll.balanceGrams} g</dd>
          </div>
          <div>
            <dt>Tara do carretel</dt>
            <dd>{roll.spoolTareGrams} g</dd>
          </div>
          <div>
            <dt>Peso inicial</dt>
            <dd>{roll.initialWeightGrams} g</dd>
          </div>
        </dl>
      </Card>

      {actionError && (
        <Alert tone="danger" role="alert">
          {actionError}
        </Alert>
      )}

      {discarded && (
        <Alert tone="neutral" title="Rolo descartado">
          O saldo restante virou perda. O histórico continua disponível.
        </Alert>
      )}

      {editable && (
        <div
          className="grid items-start"
          style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))", gap: "var(--layout-gutter)" }}
        >
          {!discarded && (
            <Card title="Pesagem" icon={Weight} subtitle={`Saldo = peso bruto − tara (${roll.spoolTareGrams} g)`}>
              <form onSubmit={submitWeigh} className="flex flex-col gap-3">
                <Field label="Peso bruto na balança (g)">
                  <Input
                    type="number"
                    value={grossWeightGrams}
                    onChange={(event) => setGrossWeightGrams(event.target.value)}
                    required
                  />
                </Field>
                {weighError && (
                  <Alert tone="danger" role="alert">
                    {weighError}
                  </Alert>
                )}
                <Button type="submit" loading={weighSubmitting} style={{ alignSelf: "flex-start" }}>
                  {weighSubmitting ? "Salvando…" : "Pesar"}
                </Button>
              </form>
            </Card>
          )}

          {!discarded && (
            <Card title="Baixa" icon={CircleMinus}>
              <form onSubmit={submitMovement} className="flex flex-col gap-3">
                <div
                  className="bf-form-grid"
                  style={{ gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,120px),1fr))" }}
                >
                  <Field label="Tipo">
                    <Select
                      value={movementType}
                      onChange={(event) => setMovementType(event.target.value as "consumo" | "perda")}
                    >
                      <option value="consumo">Consumo</option>
                      <option value="perda">Perda</option>
                    </Select>
                  </Field>
                  <Field label="Gramas">
                    <Input
                      type="number"
                      value={movementQuantity}
                      onChange={(event) => setMovementQuantity(event.target.value)}
                      required
                    />
                  </Field>
                </div>
                <Field label="Motivo">
                  <Input value={movementReason} onChange={(event) => setMovementReason(event.target.value)} />
                </Field>
                {movementError && (
                  <Alert tone="danger" role="alert">
                    {movementError}
                  </Alert>
                )}
                <Button type="submit" loading={movementSubmitting} style={{ alignSelf: "flex-start" }}>
                  {movementSubmitting ? "Salvando…" : "Dar baixa"}
                </Button>
              </form>
            </Card>
          )}

          <Card title="Abertura e secagem" icon={Droplet}>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                icon={PackageOpen}
                onClick={() => void submitOpen()}
                disabled={openSubmitting || roll.openedAt !== null}
              >
                {roll.openedAt !== null ? "Já aberto" : "Abrir rolo"}
              </Button>
              <Button variant="secondary" icon={Thermometer} onClick={() => void submitDry()} disabled={drySubmitting}>
                Registrar secagem
              </Button>
            </div>
            {!discarded && (
              <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 14 }}>
                <Button
                  variant="ghost"
                  icon={Trash2}
                  style={{ color: "var(--danger)" }}
                  onClick={() => setConfirmingDiscard(true)}
                >
                  Descartar
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}

      {confirmingDiscard && (
        <ConfirmDialog
          title="Descartar rolo"
          message={`Descartar este rolo? O saldo restante (${roll.balanceGrams} g) vira perda.`}
          confirmLabel="Descartar"
          onConfirm={() => void confirmDiscard()}
          onCancel={() => setConfirmingDiscard(false)}
          pending={discarding}
        />
      )}

      <Card title="Histórico" icon={History}>
        {roll.movements.length === 0 ? (
          <EmptyState>Nenhuma movimentação.</EmptyState>
        ) : (
          <div className="bf-table-wrap">
            <table className="bf-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th className="is-num">Gramas</th>
                  <th className="is-num">Custo (R$/g)</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {/* Chaves renomeadas na Fase 10 (door 4): a unidade do rolo continua sendo grama,
                    mas o nome do campo no contrato não fala mais de grama. */}
                {roll.movements.map((movement) => (
                  <tr key={movement.id}>
                    <td data-label="Tipo">
                      <MovementBadge type={movement.type} />
                    </td>
                    <td data-label="Gramas" className="is-num">
                      {movement.quantity}
                    </td>
                    <td data-label="Custo (R$/g)" className="is-num">
                      {movement.unitCostCents !== null ? (movement.unitCostCents / 100).toFixed(2) : "—"}
                    </td>
                    <td data-label="Data">{new Date(movement.createdAt).toLocaleString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
