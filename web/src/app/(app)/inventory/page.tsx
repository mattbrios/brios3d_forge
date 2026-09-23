"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, apiFetch } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import type { FilamentRoll, MaterialsSummary } from "@/lib/inventory";
import type { Material, MaterialsPage } from "@/lib/materials";

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

  const { role, summary, materials } = status;
  const canCreate = role === "admin";
  const activeMaterials = materials.filter((material) => material.active);

  return (
    <section className="flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Estoque de filamento</h1>

      <label className="flex flex-col gap-1 text-sm">
        Buscar material
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="tipo, marca ou cor" />
      </label>

      {summary.items.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p>Nenhum rolo em estoque.</p>
          {canCreate && (
            <button type="button" onClick={() => setShowCreateForm(true)}>
              Cadastrar rolo
            </button>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {summary.items.map((item) => (
            <li key={item.materialId} className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{materialLabel(materials, item.materialId)}</span>
                <span>{item.totalBalanceGrams} g</span>
                <span>{formatCostCentsPerGram(item.avgCostCentsPerGram)}</span>
                <span>{item.rollCount} rolo(s)</span>
                <button type="button" onClick={() => void toggleExpand(item.materialId)}>
                  {expandedMaterialId === item.materialId ? "Ocultar rolos" : "Ver rolos"}
                </button>
              </div>
              {expandedMaterialId === item.materialId && (
                <ul className="mt-2 flex flex-col gap-1 pl-4 text-sm">
                  {(rollsByMaterial[item.materialId] ?? []).map((roll) => (
                    <li key={roll.id}>
                      <Link href={`/inventory/${roll.id}`}>
                        {roll.balanceGrams} g · {roll.status}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      {canCreate && summary.items.length > 0 && !showCreateForm && (
        <button type="button" onClick={() => setShowCreateForm(true)}>
          Cadastrar rolo
        </button>
      )}

      {canCreate && showCreateForm && (
        <form onSubmit={submitCreate} className="flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">Novo rolo</h2>
          <label className="flex flex-col gap-1 text-sm">
            Material
            <select
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
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Peso inicial (g)
            <input
              type="number"
              value={createForm.initialWeightGrams}
              onChange={(event) => setCreateForm({ ...createForm, initialWeightGrams: event.target.value })}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Tara do carretel (g)
            <input
              type="number"
              value={createForm.spoolTareGrams}
              onChange={(event) => setCreateForm({ ...createForm, spoolTareGrams: event.target.value })}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Custo de aquisição (centavos)
            <input
              type="number"
              value={createForm.acquisitionCostCents}
              onChange={(event) => setCreateForm({ ...createForm, acquisitionCostCents: event.target.value })}
              required
            />
          </label>
          {createError && <p role="alert">{createError}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={creating}>
              {creating ? "Salvando…" : "Salvar"}
            </button>
            <button type="button" onClick={() => setShowCreateForm(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
