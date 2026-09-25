"use client";

import { type FormEvent, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/crud/confirm-dialog";
import { DataTable, type Column } from "@/components/crud/data-table";
import { EntityForm, type FieldConfig } from "@/components/crud/entity-form";
import { ApiError, apiFetch } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import type { Material, MaterialsPage } from "@/lib/materials";
import { Droplet, Layers, Pencil, Plus, Power, Search } from "lucide-react";
import { ActiveBadge, Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, Loading, PageError } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";

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
  { key: "type", label: "Tipo", render: (row) => <span style={{ fontWeight: 800 }}>{row.type}</span> },
  { key: "brand", label: "Marca" },
  { key: "color", label: "Cor" },
  { key: "densityGCm3", label: "Densidade", numeric: true },
  { key: "nozzleTempC", label: "Bico °C", numeric: true },
  { key: "bedTempC", label: "Mesa °C", numeric: true },
  {
    key: "minimumStockGrams",
    label: "Mínimo",
    numeric: true,
    render: (row) => (row.minimumStockGrams === null ? "—" : `${row.minimumStockGrams} g`),
  },
  {
    key: "needsDrying",
    label: "Secagem",
    render: (row) =>
      row.needsDrying ? (
        <Badge tone="warning" icon={Droplet} size="sm">
          {row.dryingTemperatureC} °C · {row.dryingHours} h
        </Badge>
      ) : (
        <span className="bf-muted">—</span>
      ),
  },
  { key: "active", label: "Situação", render: (row) => <ActiveBadge active={row.active} /> },
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
    return <Loading />;
  }

  if (status.kind === "error") {
    return <PageError message={status.message} onRetry={retry} />;
  }

  const { role, materials } = status;
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
            fields={FORM_FIELDS}
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
            fields={FORM_FIELDS}
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
