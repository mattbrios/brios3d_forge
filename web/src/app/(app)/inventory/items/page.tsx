"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { DataTable, type Column } from "@/components/crud/data-table";
import { EntityForm, type FieldConfig } from "@/components/crud/entity-form";
import { ApiError, apiFetch } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import {
  CATEGORY_LABELS,
  formatAvgCost,
  type StockItem,
  type StockItemCategory,
  type StockItemsPage,
} from "@/lib/stock-items";

type Status =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; role: AuthUser["role"]; items: StockItem[] };

type CategoryFilter = "todas" | StockItemCategory;

interface ItemFormValues {
  name: string;
  unitOfMeasure: string;
  sku: string;
  location: string;
}

const BLANK_FORM: ItemFormValues = { name: "", unitOfMeasure: "", sku: "", location: "" };

const FORM_FIELDS: FieldConfig<ItemFormValues>[] = [
  { key: "name", label: "Nome" },
  { key: "unitOfMeasure", label: "Unidade de medida (un, m, kg, L, folha)" },
  { key: "sku", label: "SKU (opcional)" },
  { key: "location", label: "Localização (opcional)" },
];

interface EntryFormValues {
  quantity: string;
  unitCostCents: string;
}

const BLANK_ENTRY: EntryFormValues = { quantity: "", unitCostCents: "" };

const ENTRY_FIELDS: FieldConfig<EntryFormValues>[] = [
  { key: "quantity", label: "Quantidade", type: "number" },
  { key: "unitCostCents", label: "Custo unitário (centavos)", type: "number" },
];

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "Não foi possível conectar à API";
}

const COLUMNS: Column<StockItem>[] = [
  {
    key: "name",
    label: "Item",
    render: (item) => <Link href={`/inventory/items/${item.id}`}>{item.name}</Link>,
  },
  { key: "category", label: "Categoria", render: (item) => CATEGORY_LABELS[item.category] },
  { key: "unitOfMeasure", label: "Unidade" },
  { key: "balanceQuantity", label: "Saldo", render: (item) => `${item.balanceQuantity} ${item.unitOfMeasure}` },
  {
    key: "avgCostCents",
    label: "Custo médio",
    render: (item) => formatAvgCost(item.avgCostCents, item.unitOfMeasure),
  },
  { key: "active", label: "Situação", render: (item) => (item.active ? "Ativo" : "Inativo") },
];

export default function StockItemsPageScreen() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [category, setCategory] = useState<CategoryFilter>("todas");

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createCategory, setCreateCategory] = useState<StockItemCategory>("insumo");
  const [createForm, setCreateForm] = useState<ItemFormValues>(BLANK_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [entryTarget, setEntryTarget] = useState<StockItem | null>(null);
  const [entryForm, setEntryForm] = useState<EntryFormValues>(BLANK_ENTRY);
  const [entrySubmitting, setEntrySubmitting] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    // Mesmo padrão de fetch-em-efeito das telas das Fases 6-9 (volta para "loading" ao refazer a
    // busca por retry ou por troca de filtro).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus({ kind: "loading" });
    const query = category === "todas" ? "?pageSize=100" : `?pageSize=100&category=${category}`;
    Promise.all([apiFetch<AuthUser>("/auth/me"), apiFetch<StockItemsPage>(`/inventory/items${query}`)])
      .then(([me, page]) => {
        if (active) setStatus({ kind: "ready", role: me.role, items: page.items });
      })
      .catch((error: unknown) => {
        if (active) setStatus({ kind: "error", message: messageOf(error) });
      });
    return () => {
      active = false;
    };
  }, [attempt, category]);

  function retry() {
    setAttempt((current) => current + 1);
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      await apiFetch<StockItem>("/inventory/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: createCategory,
          name: createForm.name,
          unitOfMeasure: createForm.unitOfMeasure,
          sku: createForm.sku || undefined,
          location: createForm.location || undefined,
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

  async function submitEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!entryTarget) return;
    setEntrySubmitting(true);
    setEntryError(null);
    try {
      await apiFetch<StockItem>(`/inventory/items/${entryTarget.id}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: Number(entryForm.quantity),
          unitCostCents: Number(entryForm.unitCostCents),
        }),
      });
      setEntryForm(BLANK_ENTRY);
      setEntryTarget(null);
      retry();
    } catch (error) {
      setEntryError(messageOf(error));
    } finally {
      setEntrySubmitting(false);
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

  const { role, items } = status;
  // Cadastro e entrada carregam dado financeiro: só admin (AC 44).
  const canManage = role === "admin";

  return (
    <section className="flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Insumos e peças</h1>

      <label className="flex flex-col gap-1 text-sm">
        Categoria
        <select value={category} onChange={(event) => setCategory(event.target.value as CategoryFilter)}>
          <option value="todas">Todas</option>
          <option value="insumo">{CATEGORY_LABELS.insumo}</option>
          <option value="peca_reposicao">{CATEGORY_LABELS.peca_reposicao}</option>
        </select>
      </label>

      {items.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p>Nenhum item cadastrado.</p>
          {canManage && (
            <button type="button" onClick={() => setShowCreateForm(true)}>
              Cadastrar item
            </button>
          )}
        </div>
      ) : (
        <DataTable
          columns={COLUMNS}
          rows={items}
          getRowId={(item) => item.id}
          renderActions={
            canManage
              ? (item) => (
                  <button type="button" onClick={() => setEntryTarget(item)}>
                    Registrar entrada
                  </button>
                )
              : undefined
          }
        />
      )}

      {canManage && entryTarget && (
        <div className="flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">Entrada de {entryTarget.name}</h2>
          <EntityForm
            fields={ENTRY_FIELDS}
            values={entryForm}
            onChange={setEntryForm}
            onSubmit={submitEntry}
            submitting={entrySubmitting}
            error={entryError}
          />
          <button type="button" onClick={() => setEntryTarget(null)}>
            Cancelar entrada
          </button>
        </div>
      )}

      {canManage && items.length > 0 && !showCreateForm && (
        <button type="button" onClick={() => setShowCreateForm(true)}>
          Cadastrar item
        </button>
      )}

      {canManage && showCreateForm && (
        <div className="flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">Novo item</h2>
          <label className="flex flex-col gap-1 text-sm">
            Categoria do item
            <select
              value={createCategory}
              onChange={(event) => setCreateCategory(event.target.value as StockItemCategory)}
            >
              <option value="insumo">{CATEGORY_LABELS.insumo}</option>
              <option value="peca_reposicao">{CATEGORY_LABELS.peca_reposicao}</option>
            </select>
          </label>
          <EntityForm
            fields={FORM_FIELDS}
            values={createForm}
            onChange={setCreateForm}
            onSubmit={submitCreate}
            submitting={creating}
            error={createError}
          />
          <button type="button" onClick={() => setShowCreateForm(false)}>
            Cancelar
          </button>
        </div>
      )}
    </section>
  );
}
