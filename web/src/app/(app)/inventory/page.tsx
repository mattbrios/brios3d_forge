"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, apiFetch } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import type { FilamentRoll, MaterialsSummary } from "@/lib/inventory";
import type { Material, MaterialsPage } from "@/lib/materials";
import { ChevronDown, ChevronUp, Disc3, Plus, Search, TriangleAlert } from "lucide-react";
import { RollStatusBadge } from "@/components/roll-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StockMeter } from "@/components/ui/data";
import { Alert, EmptyState, Loading, PageError } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/form";

type Status =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; role: AuthUser["role"]; summary: MaterialsSummary; materials: Material[] };

interface RollFormValues {
  materialId: string;
  initialWeightGrams: string;
  spoolTareGrams: string;
  acquisitionCostCents: string;
}

const BLANK_FORM: RollFormValues = {
  materialId: "",
  initialWeightGrams: "",
  spoolTareGrams: "",
  acquisitionCostCents: "",
};

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "Não foi possível conectar à API";
}

function materialLabel(materials: Material[], materialId: string): string {
  const material = materials.find((candidate) => candidate.id === materialId);
  return material ? `${material.type} · ${material.brand} · ${material.color}` : materialId;
}

function formatCostCentsPerGram(cents: number | null): string {
  return cents === null ? "—" : `R$ ${(cents / 100).toFixed(2)}/g`;
}

export default function InventoryPage() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState("");

  const [expandedMaterialId, setExpandedMaterialId] = useState<string | null>(null);
  const [rollsByMaterial, setRollsByMaterial] = useState<Record<string, FilamentRoll[]>>({});

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<RollFormValues>(BLANK_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    // Mesmo padrão de fetch-em-efeito de materials/page.tsx (volta para "loading" ao repetir
    // a busca via retry/search); o lint só reclama aqui porque este componente é menor e o
    // React Compiler consegue analisá-lo por inteiro.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus({ kind: "loading" });
    const trimmed = search.trim();
    const query = trimmed ? `?search=${encodeURIComponent(trimmed)}` : "";
    Promise.all([
      apiFetch<AuthUser>("/auth/me"),
      apiFetch<MaterialsSummary>(`/inventory/materials-summary${query}`),
      apiFetch<MaterialsPage>("/materials?pageSize=100"),
    ])
      .then(([me, summary, materials]) => {
        if (active) setStatus({ kind: "ready", role: me.role, summary, materials: materials.items });
      })
      .catch((error: unknown) => {
        if (active) setStatus({ kind: "error", message: messageOf(error) });
      });
    return () => {
      active = false;
    };
  }, [attempt, search]);

  function retry() {
    setAttempt((current) => current + 1);
  }

  async function toggleExpand(materialId: string) {
    if (expandedMaterialId === materialId) {
      setExpandedMaterialId(null);
      return;
    }
    setExpandedMaterialId(materialId);
    if (!rollsByMaterial[materialId]) {
      try {
        const page = await apiFetch<{ items: FilamentRoll[] }>(
          `/inventory/rolls?materialId=${materialId}&pageSize=100`,
        );
        setRollsByMaterial((current) => ({ ...current, [materialId]: page.items }));
      } catch {
        setRollsByMaterial((current) => ({ ...current, [materialId]: [] }));
      }
    }
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      await apiFetch<FilamentRoll>("/inventory/rolls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId: createForm.materialId,
          initialWeightGrams: Number(createForm.initialWeightGrams),
          spoolTareGrams: Number(createForm.spoolTareGrams),
          acquisitionCostCents: Number(createForm.acquisitionCostCents),
        }),
      });
      setCreateForm(BLANK_FORM);
      setShowCreateForm(false);
      retry();
    } catch (error) {
      setCreateError(messageOf(error));
    } finally {
      setCreating(false);
    }
  }

  if (status.kind === "loading") {
    return <Loading />;
  }

  if (status.kind === "error") {
    return <PageError message={status.message} onRetry={retry} />;
  }

  const { role, summary, materials } = status;
  const canCreate = role === "admin";
  const activeMaterials = materials.filter((material) => material.active);
  const totalKg = summary.items.reduce((sum, item) => sum + item.totalBalanceGrams, 0) / 1000;

  return (
    <>
      <div className="bf-page-head">
        <div style={{ flex: "1 1 220px", maxWidth: 360 }}>
          <Field label="Buscar material">
            <Input
              icon={Search}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="tipo, marca ou cor"
            />
          </Field>
        </div>
        {canCreate && summary.items.length > 0 && !showCreateForm && (
          <Button icon={Plus} onClick={() => setShowCreateForm(true)}>
            Cadastrar rolo
          </Button>
        )}
      </div>

      {canCreate && showCreateForm && (
        <Card title="Novo rolo" icon={Disc3}>
          <form onSubmit={submitCreate} className="flex flex-col gap-5">
            <div className="bf-form-grid">
              <Field label="Material" style={{ gridColumn: "1 / -1" }}>
                <Select
                  value={createForm.materialId}
                  onChange={(event) => setCreateForm({ ...createForm, materialId: event.target.value })}
                  required
                >
                  <option value="" disabled>
                    Selecione
                  </option>
                  {activeMaterials.map((material) => (
                    <option key={material.id} value={material.id}>
                      {material.type} · {material.brand} · {material.color}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Peso inicial (g)">
                <Input
                  type="number"
                  value={createForm.initialWeightGrams}
                  onChange={(event) => setCreateForm({ ...createForm, initialWeightGrams: event.target.value })}
                  required
                />
              </Field>
              <Field label="Tara do carretel (g)">
                <Input
                  type="number"
                  value={createForm.spoolTareGrams}
                  onChange={(event) => setCreateForm({ ...createForm, spoolTareGrams: event.target.value })}
                  required
                />
              </Field>
              <Field label="Custo de aquisição (centavos)">
                <Input
                  type="number"
                  value={createForm.acquisitionCostCents}
                  onChange={(event) => setCreateForm({ ...createForm, acquisitionCostCents: event.target.value })}
                  required
                />
              </Field>
            </div>
            {createError && (
              <Alert tone="danger" role="alert">
                {createError}
              </Alert>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowCreateForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={creating}>
                {creating ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card
        title={`${summary.items.length} ${summary.items.length === 1 ? "material" : "materiais"} em estoque`}
        subtitle={`${totalKg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg no total`}
      >
        {summary.items.length === 0 ? (
          <div className="flex flex-col items-center gap-3">
            <EmptyState>Nenhum rolo em estoque.</EmptyState>
            {canCreate && !showCreateForm && (
              <Button icon={Plus} onClick={() => setShowCreateForm(true)}>
                Cadastrar rolo
              </Button>
            )}
          </div>
        ) : (
          <ul className="flex flex-col" style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {summary.items.map((item) => {
              const material = materials.find((candidate) => candidate.id === item.materialId);
              const minimum = material?.minimumStockGrams ?? null;
              const low = minimum !== null && item.totalBalanceGrams < minimum;
              const expanded = expandedMaterialId === item.materialId;
              return (
                <li key={item.materialId} style={{ borderBottom: "1px solid var(--border-subtle)", padding: "14px 0" }}>
                  <div
                    className="grid items-center gap-3"
                    style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,160px),1fr))" }}
                  >
                    <div className="flex min-w-0 items-center gap-2" style={{ gridColumn: "span 2" }}>
                      <div className="min-w-0">
                        <span style={{ fontWeight: 800 }}>{materialLabel(materials, item.materialId)}</span>
                        <span className="block bf-muted" style={{ fontSize: 12, fontWeight: 600 }}>
                          {item.rollCount} rolo(s) · {formatCostCentsPerGram(item.avgCostCentsPerGram)}
                        </span>
                      </div>
                      {low && (
                        <Badge tone="warning" size="sm" icon={TriangleAlert}>
                          Abaixo do mínimo
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <StockMeter
                        value={item.totalBalanceGrams}
                        max={Math.max(item.totalBalanceGrams, (minimum ?? 0) * 2, 1000)}
                        minimum={minimum}
                      />
                      <span className="bf-meter__text">
                        {item.totalBalanceGrams} g
                        {minimum !== null && <span> / {minimum} g mín.</span>}
                      </span>
                    </div>
                    <span style={{ justifySelf: "end" }}>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={expanded ? ChevronUp : ChevronDown}
                        onClick={() => void toggleExpand(item.materialId)}
                      >
                        {expanded ? "Ocultar rolos" : "Ver rolos"}
                      </Button>
                    </span>
                  </div>
                  {expanded && (
                    <ul
                      className="mt-3 grid gap-2.5"
                      style={{
                        gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,220px),1fr))",
                        margin: "12px 0 0",
                        padding: 0,
                        listStyle: "none",
                      }}
                    >
                      {(rollsByMaterial[item.materialId] ?? []).map((roll) => (
                        <li key={roll.id}>
                          <Link
                            href={`/inventory/${roll.id}`}
                            className="bf-card bf-card--flat bf-card--tight bf-roll-card"
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span className="bf-mono bf-muted" style={{ fontSize: 12 }}>
                                {roll.id.slice(0, 8)}
                              </span>
                              <RollStatusBadge status={roll.status} size="sm" />
                            </span>
                            <StockMeter value={roll.balanceGrams} max={roll.initialWeightGrams} minimum={null} />
                            <span className="bf-meter__text">
                              {roll.balanceGrams} g · {roll.status}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
