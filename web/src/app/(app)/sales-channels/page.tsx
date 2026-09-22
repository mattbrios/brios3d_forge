"use client";

import { type FormEvent, useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import type { SalesChannel } from "@/lib/sales-channels";

type Status =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; role: AuthUser["role"]; channels: SalesChannel[] };

interface CreateForm {
  name: string;
  taxRate: string;
  feeRate: string;
}

const BLANK_CREATE: CreateForm = { name: "", taxRate: "0", feeRate: "0" };

interface EditForm {
  name: string;
  taxRate: string;
  feeRate: string;
}

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "Não foi possível conectar à API";
}

export default function SalesChannelsPage() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [createForm, setCreateForm] = useState<CreateForm>(BLANK_CREATE);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    setStatus({ kind: "loading" });
    Promise.all([apiFetch<AuthUser>("/auth/me"), apiFetch<SalesChannel[]>("/sales-channels")])
      .then(([me, channels]) => {
        if (active) setStatus({ kind: "ready", role: me.role, channels });
      })
      .catch((error: unknown) => {
        if (active) setStatus({ kind: "error", message: messageOf(error) });
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  function replaceChannel(channels: SalesChannel[], updated: SalesChannel): SalesChannel[] {
    return channels.map((channel) => (channel.id === updated.id ? updated : channel));
  }

  function retry() {
    setAttempt((current) => current + 1);
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const created = await apiFetch<SalesChannel>("/sales-channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name,
          taxRate: Number(createForm.taxRate),
          feeRate: Number(createForm.feeRate),
        }),
      });
      setStatus((current) =>
        current.kind === "ready" ? { ...current, channels: [...current.channels, created] } : current,
      );
      setCreateForm(BLANK_CREATE);
    } catch (error) {
      setCreateError(messageOf(error));
    } finally {
      setCreating(false);
    }
  }

  function startEdit(channel: SalesChannel) {
    setEditingId(channel.id);
    setEditForm({ name: channel.name, taxRate: String(channel.taxRate), feeRate: String(channel.feeRate) });
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
    setEditError(null);
  }

  async function saveEdit(channel: SalesChannel) {
    if (!editForm) return;
    const patch: Record<string, string | number> = {};
    if (editForm.name !== channel.name) patch.name = editForm.name;
    if (Number(editForm.taxRate) !== channel.taxRate) patch.taxRate = Number(editForm.taxRate);
    if (Number(editForm.feeRate) !== channel.feeRate) patch.feeRate = Number(editForm.feeRate);

    setEditSubmitting(true);
    setEditError(null);
    try {
      const updated = await apiFetch<SalesChannel>(`/sales-channels/${channel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      setStatus((current) =>
        current.kind === "ready" ? { ...current, channels: replaceChannel(current.channels, updated) } : current,
      );
      cancelEdit();
    } catch (error) {
      setEditError(messageOf(error));
    } finally {
      setEditSubmitting(false);
    }
  }

  async function toggleActive(channel: SalesChannel) {
    setToggling(channel.id);
    setRowError((current) => ({ ...current, [channel.id]: "" }));
    try {
      const updated = await apiFetch<SalesChannel>(`/sales-channels/${channel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !channel.active }),
      });
      setStatus((current) =>
        current.kind === "ready" ? { ...current, channels: replaceChannel(current.channels, updated) } : current,
      );
    } catch (error) {
      setRowError((current) => ({ ...current, [channel.id]: messageOf(error) }));
    } finally {
      setToggling(null);
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

  const { role, channels } = status;
  const editable = role === "admin";

  return (
    <section className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Canais de venda</h1>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            <th>Nome</th>
            <th>% imposto</th>
            <th>% taxa</th>
            <th>Situação</th>
            {editable && <th />}
          </tr>
        </thead>
        <tbody>
          {channels.map((channel) => {
            const isEditing = editingId === channel.id;
            return (
              <tr key={channel.id}>
                {isEditing && editForm ? (
                  <>
                    <td>
                      <label>
                        Nome
                        <input
                          value={editForm.name}
                          onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                        />
                      </label>
                    </td>
                    <td>
                      <label>
                        % imposto
                        <input
                          value={editForm.taxRate}
                          onChange={(event) => setEditForm({ ...editForm, taxRate: event.target.value })}
                        />
                      </label>
                    </td>
                    <td>
                      <label>
                        % taxa
                        <input
                          value={editForm.feeRate}
                          onChange={(event) => setEditForm({ ...editForm, feeRate: event.target.value })}
                        />
                      </label>
                    </td>
                    <td>{channel.active ? "Ativo" : "Inativo"}</td>
                    <td>
                      <button type="button" disabled={editSubmitting} onClick={() => saveEdit(channel)}>
                        Salvar
                      </button>
                      <button type="button" onClick={cancelEdit}>
                        Cancelar
                      </button>
                      {editError && <p role="alert">{editError}</p>}
                    </td>
                  </>
                ) : (
                  <>
                    <td>{channel.name}</td>
                    <td>{channel.taxRate}</td>
                    <td>{channel.feeRate}</td>
                    <td>{channel.active ? "Ativo" : "Inativo"}</td>
                    {editable && (
                      <td>
                        <button type="button" onClick={() => startEdit(channel)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={toggling === channel.id}
                          onClick={() => toggleActive(channel)}
                        >
                          {channel.active ? "Desativar" : "Ativar"}
                        </button>
                        {rowError[channel.id] && <p role="alert">{rowError[channel.id]}</p>}
                      </td>
                    )}
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {editable && (
        <form
          onSubmit={submitCreate}
          className="flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800"
        >
          <h2 className="text-lg font-semibold">Novo canal</h2>
          <label>
            Nome
            <input
              value={createForm.name}
              onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })}
            />
          </label>
          <label>
            % imposto
            <input
              value={createForm.taxRate}
              onChange={(event) => setCreateForm({ ...createForm, taxRate: event.target.value })}
            />
          </label>
          <label>
            % taxa
            <input
              value={createForm.feeRate}
              onChange={(event) => setCreateForm({ ...createForm, feeRate: event.target.value })}
            />
          </label>
          {createError && <p role="alert">{createError}</p>}
          <button type="submit" disabled={creating}>
            {creating ? "Criando…" : "Criar canal"}
          </button>
        </form>
      )}
    </section>
  );
}
