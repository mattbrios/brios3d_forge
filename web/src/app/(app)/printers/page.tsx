"use client";

import { type FormEvent, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/crud/confirm-dialog";
import { DataTable, type Column } from "@/components/crud/data-table";
import { EntityForm, type FieldConfig } from "@/components/crud/entity-form";
import { ApiError, apiFetch } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import type { Nozzle, Printer, PrintersPage } from "@/lib/printers";
import { Gauge, Pencil, Power, Printer as PrinterIcon, Search } from "lucide-react";
import { ActiveBadge, Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, Loading, PageError } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";

type Status =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; role: AuthUser["role"]; printers: Printer[] };

interface PrinterFormValues {
  name: string;
  acquisitionCostCents: string;
  lifespanHours: string;
  powerWatts: string;
  nozzles: string;
  hasAms: boolean;
  amsSlots: string;
}

const BLANK_FORM: PrinterFormValues = {
  name: "",
  acquisitionCostCents: "",
  lifespanHours: "",
  powerWatts: "",
  nozzles: "0.4:Hardened Steel",
  hasAms: false,
  amsSlots: "",
};

const FORM_FIELDS: FieldConfig<PrinterFormValues>[] = [
  { key: "name", label: "Nome" },
  { key: "acquisitionCostCents", label: "Custo de aquisição (centavos)", type: "number" },
  { key: "lifespanHours", label: "Vida útil (h)", type: "number" },
  { key: "powerWatts", label: "Potência (W)", type: "number" },
  { key: "nozzles", label: "Bicos (diâmetro:tipo, separados por vírgula)" },
  { key: "hasAms", label: "Tem AMS", type: "checkbox" },
  { key: "amsSlots", label: "Slots do AMS", type: "number" },
];

const COLUMNS: Column<Printer>[] = [
  { key: "name", label: "Nome", render: (row) => <span style={{ fontWeight: 800 }}>{row.name}</span> },
  { key: "acquisitionCostCents", label: "Custo (centavos)", numeric: true },
  { key: "lifespanHours", label: "Vida útil (h)", numeric: true },
  { key: "powerWatts", label: "Potência (W)", numeric: true },
  { key: "hourmeterHours", label: "Horímetro (h)", numeric: true },
  {
    key: "hasAms",
    label: "AMS",
    render: (row) =>
      row.hasAms ? (
        <Badge tone="violet" size="sm">{`Sim (${row.amsSlots})`}</Badge>
      ) : (
        <span className="bf-muted">Não</span>
      ),
  },
  { key: "active", label: "Situação", render: (row) => <ActiveBadge active={row.active} /> },
];

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "Não foi possível conectar à API";
}

function parseNozzles(text: string): Nozzle[] {
  return text
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const [diameter, type] = entry.split(":").map((part) => part.trim());
      return { diameterMm: Number(diameter), type: type ?? "" };
    });
}

function formatNozzles(nozzles: Nozzle[]): string {
  return nozzles.map((nozzle) => `${nozzle.diameterMm}:${nozzle.type}`).join(", ");
}

function buildBody(values: PrinterFormValues): Record<string, unknown> {
  const body: Record<string, unknown> = {
    name: values.name,
    acquisitionCostCents: Number(values.acquisitionCostCents),
    lifespanHours: Number(values.lifespanHours),
    powerWatts: Number(values.powerWatts),
    nozzles: parseNozzles(values.nozzles),
    hasAms: values.hasAms,
  };
  if (values.hasAms) {
    body.amsSlots = Number(values.amsSlots);
  }
  return body;
}

function formFromPrinter(printer: Printer): PrinterFormValues {
  return {
    name: printer.name,
    acquisitionCostCents: String(printer.acquisitionCostCents),
    lifespanHours: String(printer.lifespanHours),
    powerWatts: String(printer.powerWatts),
    nozzles: formatNozzles(printer.nozzles),
    hasAms: printer.hasAms,
    amsSlots: printer.amsSlots !== null ? String(printer.amsSlots) : "",
  };
}

export default function PrintersPage() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState("");

  const [createForm, setCreateForm] = useState<PrinterFormValues>(BLANK_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PrinterFormValues | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [confirmTarget, setConfirmTarget] = useState<Printer | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  const [hourmeterDraft, setHourmeterDraft] = useState<Record<string, string>>({});
  const [hourmeterSubmitting, setHourmeterSubmitting] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    setStatus({ kind: "loading" });
    const trimmed = search.trim();
    const query = trimmed ? `?pageSize=100&search=${encodeURIComponent(trimmed)}` : "?pageSize=100";
    Promise.all([apiFetch<AuthUser>("/auth/me"), apiFetch<PrintersPage>(`/printers${query}`)])
      .then(([me, page]) => {
        if (active) setStatus({ kind: "ready", role: me.role, printers: page.items });
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

  function replacePrinter(printers: Printer[], updated: Printer): Printer[] {
    return printers.map((printer) => (printer.id === updated.id ? updated : printer));
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const created = await apiFetch<Printer>("/printers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(createForm)),
      });
      setStatus((current) =>
        current.kind === "ready" ? { ...current, printers: [...current.printers, created] } : current,
      );
      setCreateForm(BLANK_FORM);
    } catch (error) {
      setCreateError(messageOf(error));
    } finally {
      setCreating(false);
    }
  }

  function startEdit(printer: Printer) {
    setEditingId(printer.id);
    setEditForm(formFromPrinter(printer));
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
      const updated = await apiFetch<Printer>(`/printers/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(editForm)),
      });
      setStatus((current) =>
        current.kind === "ready" ? { ...current, printers: replacePrinter(current.printers, updated) } : current,
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
      const updated = await apiFetch<Printer>(`/printers/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !target.active }),
      });
      setStatus((current) =>
        current.kind === "ready" ? { ...current, printers: replacePrinter(current.printers, updated) } : current,
      );
      setConfirmTarget(null);
    } catch (error) {
      setRowError((current) => ({ ...current, [target.id]: messageOf(error) }));
      setConfirmTarget(null);
    } finally {
      setConfirming(false);
    }
  }

  async function adjustHourmeter(printer: Printer) {
    const draft = hourmeterDraft[printer.id];
    if (draft === undefined) return;
    setHourmeterSubmitting((current) => ({ ...current, [printer.id]: true }));
    try {
      const updated = await apiFetch<Printer>(`/printers/${printer.id}/hourmeter`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hourmeterHours: Number(draft) }),
      });
      setStatus((current) =>
        current.kind === "ready" ? { ...current, printers: replacePrinter(current.printers, updated) } : current,
      );
      setRowError((current) => {
        const rest = { ...current };
        delete rest[printer.id];
        return rest;
      });
    } catch (error) {
      setRowError((current) => ({ ...current, [printer.id]: messageOf(error) }));
    } finally {
      setHourmeterSubmitting((current) => ({ ...current, [printer.id]: false }));
    }
  }

  if (status.kind === "loading") {
    return <Loading />;
  }

  if (status.kind === "error") {
    return <PageError message={status.message} onRetry={retry} />;
  }

  const { role, printers } = status;
  const editable = role === "admin";
  const canAdjustHourmeter = role === "admin" || role === "production";

  return (
    <>
      <div className="bf-page-head">
        <div style={{ flex: "1 1 220px", maxWidth: 360 }}>
          <Field label="Buscar">
            <Input
              icon={Search}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="nome"
            />
          </Field>
        </div>
      </div>

      <Card title={`${printers.length} ${printers.length === 1 ? "impressora" : "impressoras"}`}>
        {printers.length === 0 ? (
          <EmptyState>Nenhuma impressora encontrada.</EmptyState>
        ) : (
          <DataTable
            columns={COLUMNS}
            rows={printers}
            isInactive={(row) => !row.active}
          getRowId={(printer) => printer.id}
            renderActions={
              editable || canAdjustHourmeter
                ? (printer) => (
                    <div className="flex flex-col items-end gap-1">
                      {editable && (
                        <div className="flex gap-1">
                          <IconButton icon={Pencil} label="Editar" size="sm" onClick={() => startEdit(printer)} />
                          <IconButton
                          icon={Power}
                          label={printer.active ? "Desativar" : "Reativar"}
                          size="sm"
                          onClick={() => setConfirmTarget(printer)}
                        />
                        </div>
                      )}
                      {canAdjustHourmeter && (
                        <div className="flex items-end gap-2">
                          <Field label="Horímetro (h)">
                            <Input
                              inputSize="sm"
                              style={{ width: 110 }}
                              type="number"
                              value={hourmeterDraft[printer.id] ?? String(printer.hourmeterHours)}
                              onChange={(event) =>
                                setHourmeterDraft((current) => ({ ...current, [printer.id]: event.target.value }))
                              }
                            />
                          </Field>
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={Gauge}
                            onClick={() => void adjustHourmeter(printer)}
                            disabled={hourmeterSubmitting[printer.id] === true}
                          >
                            Ajustar horímetro
                          </Button>
                        </div>
                      )}
                      {rowError[printer.id] && (
                      <p role="alert" className="bf-field__error" style={{ margin: 0 }}>
                        {rowError[printer.id]}
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
          tone={confirmTarget.active ? "danger" : "neutral"}
          message={`${confirmTarget.active ? "Desativar" : "Reativar"} "${confirmTarget.name}"?`}
          confirmLabel={confirmTarget.active ? "Desativar" : "Reativar"}
          onConfirm={() => void confirmToggle()}
          onCancel={() => setConfirmTarget(null)}
          pending={confirming}
        />
      )}

      {editable &&
        (editingId && editForm ? (
          <Card title="Editar impressora" icon={Pencil}>
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
        ) : (
          <Card title="Nova impressora" icon={PrinterIcon}>
            <EntityForm
              fields={FORM_FIELDS}
              values={createForm}
              onChange={setCreateForm}
              onSubmit={submitCreate}
              submitting={creating}
              error={createError}
            />
          </Card>
        ))}
    </>
  );
}
