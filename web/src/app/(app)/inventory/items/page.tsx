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
import { Boxes, PackagePlus, Plus } from "lucide-react";
import { ActiveBadge, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StockMeter } from "@/components/ui/data";
import { EmptyState, Loading, PageError } from "@/components/ui/feedback";
import { Field, Select } from "@/components/ui/form";

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
  minimumQuantity: string;
}

const BLANK_FORM: ItemFormValues = {
  name: "",
  unitOfMeasure: "",
  sku: "",
  location: "",
  minimumQuantity: "",
};

const FORM_FIELDS: FieldConfig<ItemFormValues>[] = [
  { key: "name", label: "Nome" },
  { key: "unitOfMeasure", label: "Unidade de medida (un, m, kg, L, folha)" },
  { key: "sku", label: "SKU (opcional)" },
  { key: "location", label: "Localização (opcional)" },
  // Fase 11: piso opcional, na unidade do próprio item.
  { key: "minimumQuantity", label: "Estoque mínimo (opcional)", type: "number" },
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
  {
    key: "category",
    label: "Categoria",
    render: (item) => (
      <Badge tone={item.category === "insumo" ? "neutral" : "violet"} size="sm">
        {CATEGORY_LABELS[item.category]}
      </Badge>
    ),
  },
  { key: "unitOfMeasure", label: "Unidade" },
  {
    key: "balanceQuantity",
    label: "Saldo",
    render: (item) => (
      <div className="flex flex-col gap-1.5" style={{ minWidth: 120 }}>
        <StockMeter
          value={item.balanceQuantity}
          max={Math.max(item.balanceQuantity, (item.minimumQuantity ?? 0) * 2, 1)}
          minimum={item.minimumQuantity}
        />
        <span className="bf-meter__text">{`${item.balanceQuantity} ${item.unitOfMeasure}`}</span>
      </div>
    ),
  },
  {
    key: "minimumQuantity",
    label: "Mínimo",
    numeric: true,
    render: (item) =>
      item.minimumQuantity === null ? "—" : `${item.minimumQuantity} ${item.unitOfMeasure}`,
  },
  {
    key: "avgCostCents",
    label: "Custo médio",
    numeric: true,
    render: (item) => formatAvgCost(item.avgCostCents, item.unitOfMeasure),
  },
  { key: "active", label: "Situação", render: (item) => <ActiveBadge active={item.active} /> },
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
          minimumQuantity:
            createForm.minimumQuantity === "" ? undefined : Number(createForm.minimumQuantity),
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
    return <Loading />;
  }

  if (status.kind === "error") {
    return <PageError message={status.message} onRetry={retry} />;
  }

  const { role, items } = status;
  // Cadastro e entrada carregam dado financeiro: só admin (AC 44).
  const canManage = role === "admin";

  return (
    <>
      <div className="bf-page-head">
        <div style={{ flex: "1 1 200px", maxWidth: 280 }}>
          <Field label="Categoria">
            <Select value={category} onChange={(event) => setCategory(event.target.value as CategoryFilter)}>
              <option value="todas">Todas</option>
              <option value="insumo">{CATEGORY_LABELS.insumo}</option>
              <option value="peca_reposicao">{CATEGORY_LABELS.peca_reposicao}</option>
            </Select>
          </Field>
        </div>
        {canManage && items.length > 0 && !showCreateForm && (
          <Button icon={Plus} onClick={() => setShowCreateForm(true)}>
            Cadastrar item
          </Button>
        )}
      </div>

      {canManage && showCreateForm && (
        <Card title="Novo item" icon={Boxes}>
          <Field label="Categoria do item" style={{ maxWidth: 280 }}>
            <Select
              value={createCategory}
              onChange={(event) => setCreateCategory(event.target.value as StockItemCategory)}
            >
              <option value="insumo">{CATEGORY_LABELS.insumo}</option>
              <option value="peca_reposicao">{CATEGORY_LABELS.peca_reposicao}</option>
            </Select>
          </Field>
          <EntityForm
            fields={FORM_FIELDS}
            values={createForm}
            onChange={setCreateForm}
            onSubmit={submitCreate}
            submitting={creating}
            error={createError}
            onCancel={() => setShowCreateForm(false)}
          />
        </Card>
      )}

      {canManage && entryTarget && (
        <Card title={`Entrada de ${entryTarget.name}`} icon={PackagePlus}>
          <EntityForm
            fields={ENTRY_FIELDS}
            values={entryForm}
            onChange={setEntryForm}
            onSubmit={submitEntry}
            submitting={entrySubmitting}
            error={entryError}
            onCancel={() => setEntryTarget(null)}
            cancelLabel="Cancelar entrada"
          />
        </Card>
      )}

      <Card title={`${items.length} ${items.length === 1 ? "item" : "itens"}`}>
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3">
            <EmptyState>Nenhum item cadastrado.</EmptyState>
            {canManage && !showCreateForm && (
              <Button icon={Plus} onClick={() => setShowCreateForm(true)}>
                Cadastrar item
              </Button>
            )}
          </div>
        ) : (
          <DataTable
            columns={COLUMNS}
            rows={items}
            getRowId={(item) => item.id}
            isInactive={(item) => !item.active}
            renderActions={
              canManage
                ? (item) => (
                    <Button size="sm" variant="secondary" icon={PackagePlus} onClick={() => setEntryTarget(item)}>
                      Registrar entrada
                    </Button>
                  )
                : undefined
            }
          />
        )}
      </Card>
    </>
  );
}
