"use client";

import { type FormEvent, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/crud/confirm-dialog";
import { DataTable, type Column } from "@/components/crud/data-table";
import { EntityForm, type FieldConfig } from "@/components/crud/entity-form";
import { ApiError, apiFetch } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import type { Nozzle, Printer, PrintersPage } from "@/lib/printers";

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
  { key: "name", label: "Nome" },
  { key: "acquisitionCostCents", label: "Custo (centavos)" },
  { key: "lifespanHours", label: "Vida útil (h)" },
  { key: "powerWatts", label: "Potência (W)" },
  { key: "hourmeterHours", label: "Horímetro (h)" },
  { key: "hasAms", label: "AMS", render: (row) => (row.hasAms ? `Sim (${row.amsSlots})` : "Não") },
  { key: "active", label: "Situação", render: (row) => (row.active ? "Ativo" : "Inativo") },
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

  const { role, printers } = status;
  const editable = role === "admin";
  const canAdjustHourmeter = role === "admin" || role === "production";

  return (
    <section className="flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Impressoras</h1>

      <label className="flex flex-col gap-1 text-sm">
        Buscar
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="nome" />
      </label>

      {printers.length === 0 ? (
        <p>Nenhuma impressora encontrada.</p>
      ) : (
        <DataTable
          columns={COLUMNS}
          rows={printers}
          getRowId={(printer) => printer.id}
          renderActions={
            editable || canAdjustHourmeter
              ? (printer) => (
                  <div className="flex flex-col gap-1">
                    {editable && (
                      <div className="flex gap-2">
                        <button type="button" onClick={() => startEdit(printer)}>
                          Editar
                        </button>
                        <button type="button" onClick={() => setConfirmTarget(printer)}>
                          {printer.active ? "Desativar" : "Reativar"}
                        </button>
                      </div>
                    )}
                    {canAdjustHourmeter && (
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-xs">
                          Horímetro (h)
                          <input
                            type="number"
                            value={hourmeterDraft[printer.id] ?? String(printer.hourmeterHours)}
                            onChange={(event) =>
                              setHourmeterDraft((current) => ({ ...current, [printer.id]: event.target.value }))
                            }
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => void adjustHourmeter(printer)}
                          disabled={hourmeterSubmitting[printer.id] === true}
                        >
                          Ajustar horímetro
                        </button>
                      </div>
                    )}
                    {rowError[printer.id] && <p role="alert">{rowError[printer.id]}</p>}
                  </div>
                )
              : undefined
          }
        />
      )}

      {confirmTarget && (
        <ConfirmDialog
          message={`${confirmTarget.active ? "Desativar" : "Reativar"} "${confirmTarget.name}"?`}
          confirmLabel={confirmTarget.active ? "Desativar" : "Reativar"}
          onConfirm={() => void confirmToggle()}
          onCancel={() => setConfirmTarget(null)}
          pending={confirming}
        />
      )}

      {editable &&
        (editingId && editForm ? (
          <div className="flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <h2 className="text-lg font-semibold">Editar impressora</h2>
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
            <h2 className="text-lg font-semibold">Nova impressora</h2>
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
