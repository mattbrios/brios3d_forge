"use client";

import { type FormEvent, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/crud/confirm-dialog";
import { ApiError, apiFetch } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import type { Printer, PrintersPage } from "@/lib/printers";
import { CATEGORY_LABELS, formatAvgCost, type StockItemDetail } from "@/lib/stock-items";
import Link from "next/link";
import { CircleMinus, ClipboardCheck, Gauge, History, Power, Printer as PrinterIcon } from "lucide-react";
import { MovementBadge } from "@/components/movement-badge";
import { ActiveBadge, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StockMeter } from "@/components/ui/data";
import { Alert, EmptyState, Loading, PageError } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/form";

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
    return <Loading />;
  }

  if (status.kind === "error") {
    return <PageError message={status.message} onRetry={retry} />;
  }

  const { role, item, printers } = status;
  // Consumo, perda e contagem são ação de chão de fábrica (AC 45): vendas só lê.
  const operational = role === "admin" || role === "production";
  const canDeactivate = role === "admin" && item.active;

  return (
    <>
      <nav aria-label="Trilha" className="bf-breadcrumb">
        <Link href="/inventory/items">Insumos e peças</Link>
        <span aria-hidden="true">/</span>
        <span>{item.sku ?? item.id.slice(0, 8)}</span>
      </nav>

      <Card>
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{item.name}</h2>
          <ActiveBadge active={item.active} />
        </div>
        <StockMeter
          value={item.balanceQuantity}
          max={Math.max(item.balanceQuantity, (item.minimumQuantity ?? 0) * 2, 1)}
          minimum={item.minimumQuantity}
        />
        <dl className="bf-dl">
          <div>
            <dt>Categoria</dt>
            <dd>{CATEGORY_LABELS[item.category]}</dd>
          </div>
          <div>
            <dt>Saldo</dt>
            <dd>
              {item.balanceQuantity} {item.unitOfMeasure}
            </dd>
          </div>
          <div>
            <dt>Estoque mínimo</dt>
            <dd>{item.minimumQuantity === null ? "—" : `${item.minimumQuantity} ${item.unitOfMeasure}`}</dd>
          </div>
          <div>
            <dt>Custo médio</dt>
            <dd>{formatAvgCost(item.avgCostCents, item.unitOfMeasure)}</dd>
          </div>
          <div>
            <dt>SKU</dt>
            <dd className="bf-mono">{item.sku ?? "—"}</dd>
          </div>
          <div>
            <dt>Localização</dt>
            <dd>{item.location ?? "—"}</dd>
          </div>
        </dl>
      </Card>

      {item.category === "peca_reposicao" && (
        <Card title="Impressoras compatíveis" icon={PrinterIcon}>
          {item.compatiblePrinterIds.length === 0 ? (
            <EmptyState>Nenhuma impressora vinculada.</EmptyState>
          ) : (
            <ul className="flex flex-wrap gap-2" style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {item.compatiblePrinterIds.map((printerId) => (
                <li key={printerId}>
                  <Badge tone="neutral">{printerLabel(printers, printerId)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {actionError && (
        <Alert tone="danger" role="alert">
          {actionError}
        </Alert>
      )}

      {(role === "admin" || operational) && (
        <div
          className="grid items-start"
          style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))", gap: "var(--layout-gutter)" }}
        >
          {role === "admin" && (
            <Card title="Estoque mínimo" icon={Gauge}>
              <form onSubmit={submitMinimum} className="flex flex-col gap-3">
                <Field label={`Mínimo (${item.unitOfMeasure}), vazio para nenhum`}>
                  <Input
                    type="number"
                    value={minimumQuantity ?? ""}
                    onChange={(event) => setMinimumQuantity(event.target.value)}
                  />
                </Field>
                {minimumError && (
                  <Alert tone="danger" role="alert">
                    {minimumError}
                  </Alert>
                )}
                <Button type="submit" loading={minimumSubmitting} style={{ alignSelf: "flex-start" }}>
                  {minimumSubmitting ? "Salvando…" : "Salvar mínimo"}
                </Button>
              </form>
            </Card>
          )}

          {operational && (
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
                  <Field label={`Quantidade (${item.unitOfMeasure})`}>
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

          {operational && (
            <Card title="Contagem de inventário" icon={ClipboardCheck}>
              <form onSubmit={submitCount} className="flex flex-col gap-3">
                <Field label={`Quantidade contada (${item.unitOfMeasure})`}>
                  <Input
                    type="number"
                    value={countedQuantity}
                    onChange={(event) => setCountedQuantity(event.target.value)}
                    required
                  />
                </Field>
                {countError && (
                  <Alert tone="danger" role="alert">
                    {countError}
                  </Alert>
                )}
                <Button type="submit" loading={countSubmitting} style={{ alignSelf: "flex-start" }}>
                  {countSubmitting ? "Salvando…" : "Registrar contagem"}
                </Button>
              </form>
              {canDeactivate && (
                <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 14 }}>
                  <Button
                    variant="ghost"
                    icon={Power}
                    style={{ color: "var(--danger)" }}
                    onClick={() => setConfirmingDeactivate(true)}
                  >
                    Desativar
                  </Button>
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {confirmingDeactivate && (
        <ConfirmDialog
          title="Desativar item"
          message={`Desativar "${item.name}"? O histórico e o saldo continuam, mas o item não aceita mais entrada.`}
          confirmLabel="Desativar"
          onConfirm={() => void confirmDeactivate()}
          onCancel={() => setConfirmingDeactivate(false)}
          pending={deactivating}
        />
      )}

      <Card title="Histórico" icon={History}>
        {item.movements.length === 0 ? (
          <EmptyState>Nenhuma movimentação.</EmptyState>
        ) : (
          <div className="bf-table-wrap">
            <table className="bf-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th className="is-num">Quantidade</th>
                  <th className="is-num">Custo unitário</th>
                  <th>Motivo</th>
                  <th>Usuário</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {item.movements.map((movement) => (
                  <tr key={movement.id}>
                    <td data-label="Tipo">
                      <MovementBadge type={movement.type} />
                    </td>
                    <td data-label="Quantidade" className="is-num">
                      {movement.quantity}
                    </td>
                    <td data-label="Custo unitário" className="is-num">
                      {movement.unitCostCents !== null ? (movement.unitCostCents / 100).toFixed(2) : "—"}
                    </td>
                    <td data-label="Motivo">{movement.reason ?? "—"}</td>
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
    </>
  );
}
