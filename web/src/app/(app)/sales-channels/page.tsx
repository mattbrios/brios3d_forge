"use client";

import { type FormEvent, useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import type { SalesChannel } from "@/lib/sales-channels";
import { Pencil, Plus, Power, Store } from "lucide-react";
import { ActiveBadge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, Loading, PageError } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";

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
    return <Loading />;
  }

  if (status.kind === "error") {
    return <PageError message={status.message} onRetry={retry} />;
  }

  const { role, channels } = status;
  const editable = role === "admin";

  return (
    <>
      <Card title={`${channels.length} ${channels.length === 1 ? "canal" : "canais"}`} icon={Store}>
        <div className="bf-table-wrap">
          <table className="bf-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th className="is-num">% imposto</th>
                <th className="is-num">% taxa</th>
                <th>Situação</th>
                {editable && <th aria-label="Ações" />}
              </tr>
            </thead>
            <tbody>
              {channels.map((channel) => {
                const isEditing = editingId === channel.id;
                return (
                  <tr key={channel.id} className={channel.active ? undefined : "is-inactive"}>
                    {isEditing && editForm ? (
                      <>
                        <td data-label="Nome">
                          <Field label="Nome">
                            <Input
                              inputSize="sm"
                              value={editForm.name}
                              onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                            />
                          </Field>
                        </td>
                        <td data-label="% imposto">
                          <Field label="% imposto">
                            <Input
                              inputSize="sm"
                              value={editForm.taxRate}
                              onChange={(event) => setEditForm({ ...editForm, taxRate: event.target.value })}
                            />
                          </Field>
                        </td>
                        <td data-label="% taxa">
                          <Field label="% taxa">
                            <Input
                              inputSize="sm"
                              value={editForm.feeRate}
                              onChange={(event) => setEditForm({ ...editForm, feeRate: event.target.value })}
                            />
                          </Field>
                        </td>
                        <td data-label="Situação">
                          <ActiveBadge active={channel.active} />
                        </td>
                        <td className="bf-table__actions-cell">
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex gap-2">
                              <Button size="sm" disabled={editSubmitting} onClick={() => saveEdit(channel)}>
                                Salvar
                              </Button>
                              <Button size="sm" variant="secondary" onClick={cancelEdit}>
                                Cancelar
                              </Button>
                            </div>
                            {editError && (
                              <p role="alert" className="bf-field__error" style={{ margin: 0 }}>
                                {editError}
                              </p>
                            )}
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td data-label="Nome" style={{ fontWeight: 800 }}>
                          {channel.name}
                        </td>
                        <td data-label="% imposto" className="is-num">
                          {channel.taxRate}
                        </td>
                        <td data-label="% taxa" className="is-num">
                          {channel.feeRate}
                        </td>
                        <td data-label="Situação">
                          <ActiveBadge active={channel.active} />
                        </td>
                        {editable && (
                          <td className="bf-table__actions-cell">
                            <div className="flex flex-col items-end gap-1">
                              <div className="bf-table__actions">
                                <IconButton
                                  icon={Pencil}
                                  label="Editar"
                                  size="sm"
                                  onClick={() => startEdit(channel)}
                                />
                                <IconButton
                                  icon={Power}
                                  label={channel.active ? "Desativar" : "Ativar"}
                                  size="sm"
                                  disabled={toggling === channel.id}
                                  onClick={() => toggleActive(channel)}
                                />
                              </div>
                              {rowError[channel.id] && (
                                <p role="alert" className="bf-field__error" style={{ margin: 0 }}>
                                  {rowError[channel.id]}
                                </p>
                              )}
                            </div>
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {editable && (
        <Card title="Novo canal" icon={Plus}>
          <form onSubmit={submitCreate} className="flex flex-col gap-5">
            <div className="bf-form-grid">
              <Field label="Nome">
                <Input
                  value={createForm.name}
                  onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })}
                />
              </Field>
              <Field label="% imposto">
                <Input
                  value={createForm.taxRate}
                  onChange={(event) => setCreateForm({ ...createForm, taxRate: event.target.value })}
                />
              </Field>
              <Field label="% taxa">
                <Input
                  value={createForm.feeRate}
                  onChange={(event) => setCreateForm({ ...createForm, feeRate: event.target.value })}
                />
              </Field>
            </div>
            {createError && (
              <Alert tone="danger" role="alert">
                {createError}
              </Alert>
            )}
            <div className="flex justify-end">
              <Button type="submit" loading={creating}>
                {creating ? "Criando…" : "Criar canal"}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </>
  );
}
