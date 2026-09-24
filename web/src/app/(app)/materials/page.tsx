"use client";

import { type FormEvent, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/crud/confirm-dialog";
import { DataTable, type Column } from "@/components/crud/data-table";
import { EntityForm, type FieldConfig } from "@/components/crud/entity-form";
import { ApiError, apiFetch } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import type { Material, MaterialsPage } from "@/lib/materials";

type Status =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; role: AuthUser["role"]; materials: Material[] };

interface MaterialFormValues {
  type: string;
  brand: string;
  color: string;
  densityGCm3: string;
  nozzleTempC: string;
  bedTempC: string;
  needsDrying: boolean;
  dryingTemperatureC: string;
  dryingHours: string;
  minimumStockGrams: string;
}

const BLANK_FORM: MaterialFormValues = {
  type: "",
  brand: "",
  color: "",
  densityGCm3: "",
  nozzleTempC: "",
  bedTempC: "",
  needsDrying: false,
  dryingTemperatureC: "",
  dryingHours: "",
  minimumStockGrams: "",
};

const FORM_FIELDS: FieldConfig<MaterialFormValues>[] = [
  { key: "type", label: "Tipo" },
  { key: "brand", label: "Marca" },
  { key: "color", label: "Cor" },
  { key: "densityGCm3", label: "Densidade (g/cm³)", type: "number" },
  { key: "nozzleTempC", label: "Temperatura do bico (°C)", type: "number" },
  { key: "bedTempC", label: "Temperatura da mesa (°C)", type: "number" },
  { key: "needsDrying", label: "Precisa secar", type: "checkbox" },
  { key: "dryingTemperatureC", label: "Temperatura de secagem (°C)", type: "number" },
  { key: "dryingHours", label: "Horas de secagem", type: "number" },
  // Fase 11: piso opcional; campo vazio limpa a política (envia null).
  { key: "minimumStockGrams", label: "Estoque mínimo (g, opcional)", type: "number" },
];

const COLUMNS: Column<Material>[] = [
  { key: "type", label: "Tipo" },
  { key: "brand", label: "Marca" },
  { key: "color", label: "Cor" },
  { key: "densityGCm3", label: "Densidade" },
  { key: "nozzleTempC", label: "Bico °C" },
  { key: "bedTempC", label: "Mesa °C" },
  {
    key: "minimumStockGrams",
    label: "Mínimo",
    render: (row) => (row.minimumStockGrams === null ? "—" : `${row.minimumStockGrams} g`),
  },
  { key: "active", label: "Situação", render: (row) => (row.active ? "Ativo" : "Inativo") },
];

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "Não foi possível conectar à API";
}

function buildBody(values: MaterialFormValues): Record<string, unknown> {
  const body: Record<string, unknown> = {
    type: values.type,
    brand: values.brand,
    color: values.color,
    densityGCm3: Number(values.densityGCm3),
    nozzleTempC: Number(values.nozzleTempC),
    bedTempC: Number(values.bedTempC),
    needsDrying: values.needsDrying,
  };
  if (values.needsDrying) {
    body.dryingTemperatureC = Number(values.dryingTemperatureC);
    body.dryingHours = Number(values.dryingHours);
  }
  // Campo vazio é "sem mínimo": `null` explícito, que é o que limpa a política no PATCH.
  body.minimumStockGrams = values.minimumStockGrams === "" ? null : Number(values.minimumStockGrams);
  return body;
}

function formFromMaterial(material: Material): MaterialFormValues {
  return {
    type: material.type,
    brand: material.brand,
    color: material.color,
    densityGCm3: String(material.densityGCm3),
    nozzleTempC: String(material.nozzleTempC),
    bedTempC: String(material.bedTempC),
    needsDrying: material.needsDrying,
    dryingTemperatureC: material.dryingTemperatureC !== null ? String(material.dryingTemperatureC) : "",
    dryingHours: material.dryingHours !== null ? String(material.dryingHours) : "",
    minimumStockGrams: material.minimumStockGrams !== null ? String(material.minimumStockGrams) : "",
  };
}

export default function MaterialsPage() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState("");

  const [createForm, setCreateForm] = useState<MaterialFormValues>(BLANK_FORM);
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

  function retry() {
    setAttempt((current) => current + 1);
  }

  function replaceMaterial(materials: Material[], updated: Material): Material[] {
    return materials.map((material) => (material.id === updated.id ? updated : material));
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const created = await apiFetch<Material>("/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(createForm)),
      });
      setStatus((current) =>
        current.kind === "ready" ? { ...current, materials: [...current.materials, created] } : current,
      );
      setCreateForm(BLANK_FORM);
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
    setEditSubmitting(true);
    setEditError(null);
    try {
      const updated = await apiFetch<Material>(`/materials/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(editForm)),
      });
      setStatus((current) =>
        current.kind === "ready" ? { ...current, materials: replaceMaterial(current.materials, updated) } : current,
      );
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

  const { role, materials } = status;
  const editable = role === "admin";

  return (
    <section className="flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Materiais</h1>

      <label className="flex flex-col gap-1 text-sm">
        Buscar
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="tipo, marca ou cor"
        />
      </label>

      {materials.length === 0 ? (
        <p>Nenhum material encontrado.</p>
      ) : (
        <DataTable
          columns={COLUMNS}
          rows={materials}
          getRowId={(material) => material.id}
          renderActions={
            editable
              ? (material) => (
                  <div className="flex flex-col gap-1">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => startEdit(material)}>
                        Editar
                      </button>
                      <button type="button" onClick={() => setConfirmTarget(material)}>
                        {material.active ? "Desativar" : "Reativar"}
                      </button>
                    </div>
                    {rowError[material.id] && <p role="alert">{rowError[material.id]}</p>}
                  </div>
                )
              : undefined
          }
        />
      )}

      {confirmTarget && (
        <ConfirmDialog
          message={`${confirmTarget.active ? "Desativar" : "Reativar"} "${confirmTarget.type} · ${confirmTarget.brand}"?`}
          confirmLabel={confirmTarget.active ? "Desativar" : "Reativar"}
          onConfirm={() => void confirmToggle()}
          onCancel={() => setConfirmTarget(null)}
          pending={confirming}
        />
      )}

      {editable &&
        (editingId && editForm ? (
          <div className="flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <h2 className="text-lg font-semibold">Editar material</h2>
            <EntityForm
              fields={FORM_FIELDS}
              values={editForm}
              onChange={setEditForm}
              onSubmit={submitEdit}
              submitting={editSubmitting}
              error={editError}
            />
            <button type="button" onClick={cancelEdit}>
              Cancelar edição
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <h2 className="text-lg font-semibold">Novo material</h2>
            <EntityForm
              fields={FORM_FIELDS}
              values={createForm}
              onChange={setCreateForm}
              onSubmit={submitCreate}
              submitting={creating}
              error={createError}
            />
          </div>
        ))}
    </section>
  );
}
