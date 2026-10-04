"use client";

import { type FormEvent, useEffect, useId, useState } from "react";
import { ConfirmDialog } from "@/components/crud/confirm-dialog";
import { DataTable, type Column } from "@/components/crud/data-table";
import { EntityForm, type FieldConfig } from "@/components/crud/entity-form";
import { ApiError, apiFetch } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import type { Material, MaterialsPage } from "@/lib/materials";
import { Layers, Pencil, Plus, Power, Search } from "lucide-react";
import { ActiveBadge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Card } from "@/components/ui/card";
import { EmptyState, Loading, PageError } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { formatQuantity } from "@/lib/format";
import { decimalToInput, readNumbers } from "@/lib/number-input";

type Status =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; role: AuthUser["role"]; materials: Material[] };

interface MaterialFormValues {
  type: string;
  brand: string;
  color: string;
  // Tom `#rrggbb`, ou "" para "sem tom" (enviado como `null`).
  colorHex: string;
  densityGCm3: string;
  nozzleTempC: string;
  bedTempC: string;
  minimumStockGrams: string;
}

// Valores usuais de um filamento novo. Só o web conhece: a API continua exigindo os números.
const NEW_MATERIAL_DEFAULTS: MaterialFormValues = {
  type: "",
  brand: "",
  color: "",
  colorHex: "",
  densityGCm3: "1,24",
  nozzleTempC: "220",
  bedTempC: "65",
  minimumStockGrams: "100",
};

// Amostra do tom: o <label> de um <input type="color">, então clicar nela abre o seletor nativo.
function ColorField({
  values,
  onChange,
}: {
  values: MaterialFormValues;
  onChange: (values: MaterialFormValues) => void;
}) {
  const toneId = useId();
  return (
    <div className="bf-color-field">
      <Input value={values.color} onChange={(event) => onChange({ ...values, color: event.target.value })} />
      <input
        id={toneId}
        type="color"
        aria-label="Tom"
        className="bf-visually-hidden"
        // O input nativo não tem "vazio": sem tom ele mostra preto, mas quem decide é o estado.
        value={values.colorHex || "#000000"}
        onChange={(event) => onChange({ ...values, colorHex: event.target.value })}
      />
      <label
        htmlFor={toneId}
        title="Escolher tom"
        className={values.colorHex ? "bf-swatch" : "bf-swatch bf-swatch--none"}
        style={values.colorHex ? { background: values.colorHex } : undefined}
      >
        <span className="bf-visually-hidden">Escolher tom</span>
      </label>
      {values.colorHex && (
        <Button variant="ghost" size="sm" onClick={() => onChange({ ...values, colorHex: "" })}>
          Remover
        </Button>
      )}
    </div>
  );
}

function formFields(brands: string[]): FieldConfig<MaterialFormValues>[] {
  return [
    { key: "type", label: "Tipo" },
    {
      key: "brand",
      label: "Marca",
      render: ({ values, onChange }) => (
        <Combobox value={values.brand} onChange={(brand) => onChange({ ...values, brand })} options={brands} />
      ),
    },
    { key: "color", label: "Cor", render: (props) => <ColorField {...props} /> },
    { key: "densityGCm3", label: "Densidade (g/cm³)", type: "number" },
    { key: "nozzleTempC", label: "Temperatura do bico (°C)", type: "number" },
    { key: "bedTempC", label: "Temperatura da mesa (°C)", type: "number" },
    // Fase 11: piso opcional; campo vazio limpa a política (envia null).
    { key: "minimumStockGrams", label: "Estoque mínimo (g, opcional)", type: "number" },
  ];
}

// A marca salva entra nas sugestões sem recarregar, com a grafia nova no lugar da antiga (a API
// também devolve a grafia do material mais recente), na mesma ordem sem diferenciar maiúsculas.
function withBrand(brands: string[], brand: string): string[] {
  const others = brands.filter((current) => current.toLowerCase() !== brand.toLowerCase());
  return [...others, brand].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

const COLUMNS: Column<Material>[] = [
  { key: "type", label: "Tipo", render: (row) => <span style={{ fontWeight: 800 }}>{row.type}</span> },
  { key: "brand", label: "Marca" },
  {
    key: "color",
    label: "Cor",
    render: (row) =>
      row.colorHex ? (
        <span className="bf-color-cell">
          <span role="img" aria-label={`Tom ${row.colorHex}`} className="bf-swatch bf-swatch--sm" style={{ background: row.colorHex }} />
          {row.color}
        </span>
      ) : (
        row.color
      ),
  },
  { key: "densityGCm3", label: "Densidade", numeric: true, render: (row) => formatQuantity(row.densityGCm3) },
  { key: "nozzleTempC", label: "Bico °C", numeric: true, render: (row) => formatQuantity(row.nozzleTempC) },
  { key: "bedTempC", label: "Mesa °C", numeric: true, render: (row) => formatQuantity(row.bedTempC) },
  {
    key: "minimumStockGrams",
    label: "Mínimo",
    numeric: true,
    render: (row) => (row.minimumStockGrams === null ? "—" : `${formatQuantity(row.minimumStockGrams)} g`),
  },
  { key: "active", label: "Situação", render: (row) => <ActiveBadge active={row.active} /> },
];

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "Não foi possível conectar à API";
}

function buildBody(values: MaterialFormValues): { ok: true; body: Record<string, unknown> } | { ok: false; message: string } {
  // Campo vazio no mínimo é "sem mínimo": `null` explícito, que é o que limpa a política no PATCH.
  const parsed = readNumbers({
    densityGCm3: { label: "Densidade", text: values.densityGCm3, required: true },
    nozzleTempC: { label: "Temperatura do bico", text: values.nozzleTempC, required: true },
    bedTempC: { label: "Temperatura da mesa", text: values.bedTempC, required: true },
    minimumStockGrams: { label: "Estoque mínimo", text: values.minimumStockGrams },
  });
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    body: {
      type: values.type,
      brand: values.brand,
      color: values.color,
      colorHex: values.colorHex === "" ? null : values.colorHex,
      ...parsed.values,
    },
  };
}

function formFromMaterial(material: Material): MaterialFormValues {
  return {
    type: material.type,
    brand: material.brand,
    color: material.color,
    colorHex: material.colorHex ?? "",
    densityGCm3: decimalToInput(material.densityGCm3),
    nozzleTempC: decimalToInput(material.nozzleTempC),
    bedTempC: decimalToInput(material.bedTempC),
    minimumStockGrams: material.minimumStockGrams !== null ? decimalToInput(material.minimumStockGrams) : "",
  };
}

export default function MaterialsPage() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState("");

  // Sugestões da Marca; `null` até a primeira busca. Falhar deixa a lista vazia, sem alerta.
  const [brands, setBrands] = useState<string[] | null>(null);

  const [createForm, setCreateForm] = useState<MaterialFormValues>(NEW_MATERIAL_DEFAULTS);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<MaterialFormValues | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [confirmTarget, setConfirmTarget] = useState<Material | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    setStatus({ kind: "loading" });
    const trimmed = search.trim();
    const query = trimmed ? `?pageSize=100&search=${encodeURIComponent(trimmed)}` : "?pageSize=100";
    Promise.all([apiFetch<AuthUser>("/auth/me"), apiFetch<MaterialsPage>(`/materials${query}`)])
      .then(([me, page]) => {
        if (active) setStatus({ kind: "ready", role: me.role, materials: page.items });
      })
      .catch((error: unknown) => {
        if (active) setStatus({ kind: "error", message: messageOf(error) });
      });
    return () => {
      active = false;
    };
  }, [attempt, search]);

  // Só o admin vê os formulários, então só ele busca as marcas, uma vez por tela.
  const isAdmin = status.kind === "ready" && status.role === "admin";
  useEffect(() => {
    if (!isAdmin || brands !== null) return;
    apiFetch<string[]>("/materials/brands")
      .then(setBrands)
      .catch(() => setBrands([]));
  }, [isAdmin, brands]);

  function rememberBrand(brand: string) {
    setBrands((current) => withBrand(current ?? [], brand));
  }

  function retry() {
    setAttempt((current) => current + 1);
  }

  function replaceMaterial(materials: Material[], updated: Material): Material[] {
    return materials.map((material) => (material.id === updated.id ? updated : material));
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const built = buildBody(createForm);
    if (!built.ok) {
      setCreateError(built.message);
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const created = await apiFetch<Material>("/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(built.body),
      });
      setStatus((current) =>
        current.kind === "ready" ? { ...current, materials: [...current.materials, created] } : current,
      );
      rememberBrand(created.brand);
      setCreateForm(NEW_MATERIAL_DEFAULTS);
    } catch (error) {
      setCreateError(messageOf(error));
    } finally {
      setCreating(false);
    }
  }

  function startEdit(material: Material) {
    setEditingId(material.id);
    setEditForm(formFromMaterial(material));
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
    setEditError(null);
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId || !editForm) return;
    const built = buildBody(editForm);
    if (!built.ok) {
      setEditError(built.message);
      return;
    }
    setEditSubmitting(true);
    setEditError(null);
    try {
      const updated = await apiFetch<Material>(`/materials/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(built.body),
      });
      setStatus((current) =>
        current.kind === "ready" ? { ...current, materials: replaceMaterial(current.materials, updated) } : current,
      );
      rememberBrand(updated.brand);
      cancelEdit();
    } catch (error) {
      setEditError(messageOf(error));
    } finally {
      setEditSubmitting(false);
    }
  }

  async function confirmToggle() {
    if (!confirmTarget) return;
    const target = confirmTarget;
    setConfirming(true);
    try {
      const updated = await apiFetch<Material>(`/materials/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !target.active }),
      });
      setStatus((current) =>
        current.kind === "ready" ? { ...current, materials: replaceMaterial(current.materials, updated) } : current,
      );
      setConfirmTarget(null);
    } catch (error) {
      setRowError((current) => ({ ...current, [target.id]: messageOf(error) }));
      setConfirmTarget(null);
    } finally {
      setConfirming(false);
    }
  }

  if (status.kind === "loading") {
    return <Loading />;
  }

  if (status.kind === "error") {
    return <PageError message={status.message} onRetry={retry} />;
  }

  const { role, materials } = status;
  const fields = formFields(brands ?? []);
  const editable = role === "admin";
  const activeCount = materials.filter((material) => material.active).length;

  return (
    <>
      <div className="bf-page-head">
        <div style={{ flex: "1 1 220px", maxWidth: 360 }}>
          <Field label="Buscar">
            <Input
              icon={Search}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="tipo, marca ou cor"
            />
          </Field>
        </div>
      </div>

      {editable && editingId && editForm && (
        <Card title="Editar material" icon={Layers}>
          <EntityForm
            fields={fields}
            values={editForm}
            onChange={setEditForm}
            onSubmit={submitEdit}
            submitting={editSubmitting}
            error={editError}
            onCancel={cancelEdit}
            cancelLabel="Cancelar edição"
          />
        </Card>
      )}

      <Card
        title={`${materials.length} ${materials.length === 1 ? "material" : "materiais"}`}
        subtitle={`${activeCount} ${activeCount === 1 ? "ativo" : "ativos"}`}
      >
        {materials.length === 0 ? (
          <EmptyState>Nenhum material encontrado.</EmptyState>
        ) : (
          <DataTable
            columns={COLUMNS}
            rows={materials}
            getRowId={(material) => material.id}
            isInactive={(material) => !material.active}
            renderActions={
              editable
                ? (material) => (
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex gap-1">
                        <IconButton icon={Pencil} label="Editar" size="sm" onClick={() => startEdit(material)} />
                        <IconButton
                          icon={Power}
                          label={material.active ? "Desativar" : "Reativar"}
                          size="sm"
                          onClick={() => setConfirmTarget(material)}
                        />
                      </div>
                      {rowError[material.id] && (
                        <p role="alert" className="bf-field__error" style={{ margin: 0 }}>
                          {rowError[material.id]}
                        </p>
                      )}
                    </div>
                  )
                : undefined
            }
          />
        )}
      </Card>

      {confirmTarget && (
        <ConfirmDialog
          title={confirmTarget.active ? "Desativar material" : "Reativar material"}
          tone={confirmTarget.active ? "danger" : "neutral"}
          message={`${confirmTarget.active ? "Desativar" : "Reativar"} "${confirmTarget.type} · ${confirmTarget.brand}"?`}
          confirmLabel={confirmTarget.active ? "Desativar" : "Reativar"}
          onConfirm={() => void confirmToggle()}
          onCancel={() => setConfirmTarget(null)}
          pending={confirming}
        />
      )}

      {editable && !editingId && (
        <Card title="Novo material" icon={Plus}>
          <EntityForm
            fields={fields}
            values={createForm}
            onChange={setCreateForm}
            onSubmit={submitCreate}
            submitting={creating}
            error={createError}
          />
        </Card>
      )}
    </>
  );
}
