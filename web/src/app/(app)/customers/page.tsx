"use client";

import { type FormEvent, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/crud/confirm-dialog";
import { DataTable, type Column } from "@/components/crud/data-table";
import { EntityForm, type FieldConfig } from "@/components/crud/entity-form";
import { ApiError, apiFetch } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import type { Customer, CustomersPage } from "@/lib/customers";

type Status =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; role: AuthUser["role"]; customers: Customer[] };

interface CustomerFormValues {
  name: string;
  document: string;
  phone: string;
  email: string;
  address: string;
}

const BLANK_FORM: CustomerFormValues = { name: "", document: "", phone: "", email: "", address: "" };

const FORM_FIELDS: FieldConfig<CustomerFormValues>[] = [
  { key: "name", label: "Nome" },
  { key: "document", label: "CPF/CNPJ" },
  { key: "phone", label: "Telefone" },
  { key: "email", label: "E-mail" },
  { key: "address", label: "Endereço" },
];

const COLUMNS: Column<Customer>[] = [
  { key: "name", label: "Nome" },
  { key: "document", label: "CPF/CNPJ" },
  { key: "phone", label: "Telefone" },
  { key: "email", label: "E-mail" },
  { key: "active", label: "Situação", render: (row) => (row.active ? "Ativo" : "Inativo") },
];

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "Não foi possível conectar à API";
}

function buildBody(values: CustomerFormValues): Record<string, unknown> {
  const body: Record<string, unknown> = { name: values.name };
  if (values.document.trim()) body.document = values.document.trim();
  if (values.phone.trim()) body.phone = values.phone.trim();
  if (values.email.trim()) body.email = values.email.trim();
  if (values.address.trim()) body.address = values.address.trim();
  return body;
}

function formFromCustomer(customer: Customer): CustomerFormValues {
  return {
    name: customer.name,
    document: customer.document ?? "",
    phone: customer.phone ?? "",
    email: customer.email ?? "",
    address: customer.address ?? "",
  };
}

export default function CustomersPage() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState("");

  const [createForm, setCreateForm] = useState<CustomerFormValues>(BLANK_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<CustomerFormValues | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [confirmTarget, setConfirmTarget] = useState<Customer | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    setStatus({ kind: "loading" });
    const trimmed = search.trim();
    const query = trimmed ? `?pageSize=100&search=${encodeURIComponent(trimmed)}` : "?pageSize=100";
    Promise.all([apiFetch<AuthUser>("/auth/me"), apiFetch<CustomersPage>(`/customers${query}`)])
      .then(([me, page]) => {
        if (active) setStatus({ kind: "ready", role: me.role, customers: page.items });
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

  function replaceCustomer(customers: Customer[], updated: Customer): Customer[] {
    return customers.map((customer) => (customer.id === updated.id ? updated : customer));
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const created = await apiFetch<Customer>("/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(createForm)),
      });
      setStatus((current) =>
        current.kind === "ready" ? { ...current, customers: [...current.customers, created] } : current,
      );
      setCreateForm(BLANK_FORM);
    } catch (error) {
      setCreateError(messageOf(error));
    } finally {
      setCreating(false);
    }
  }

  function startEdit(customer: Customer) {
    setEditingId(customer.id);
    setEditForm(formFromCustomer(customer));
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
      const updated = await apiFetch<Customer>(`/customers/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(editForm)),
      });
      setStatus((current) =>
        current.kind === "ready" ? { ...current, customers: replaceCustomer(current.customers, updated) } : current,
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
      const updated = await apiFetch<Customer>(`/customers/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !target.active }),
      });
      setStatus((current) =>
        current.kind === "ready" ? { ...current, customers: replaceCustomer(current.customers, updated) } : current,
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

  const { role, customers } = status;
  const editable = role === "admin" || role === "sales";

  return (
    <section className="flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Clientes</h1>

      <label className="flex flex-col gap-1 text-sm">
        Buscar
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="nome" />
      </label>

      {customers.length === 0 ? (
        <p>Nenhum cliente encontrado.</p>
      ) : (
        <DataTable
          columns={COLUMNS}
          rows={customers}
          getRowId={(customer) => customer.id}
          renderActions={
            editable
              ? (customer) => (
                  <div className="flex flex-col gap-1">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => startEdit(customer)}>
                        Editar
                      </button>
                      <button type="button" onClick={() => setConfirmTarget(customer)}>
                        {customer.active ? "Desativar" : "Reativar"}
                      </button>
                    </div>
                    {rowError[customer.id] && <p role="alert">{rowError[customer.id]}</p>}
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
            <h2 className="text-lg font-semibold">Editar cliente</h2>
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
            <h2 className="text-lg font-semibold">Novo cliente</h2>
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
