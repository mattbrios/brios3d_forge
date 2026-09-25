"use client";

import { type FormEvent, useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import type { AuthUser, UserRole } from "@/lib/auth";
import { ROLE_LABELS, type PublicUser } from "@/lib/users";
import { Pencil, Power, UserPlus } from "lucide-react";
import { ActiveBadge, Badge, type BadgeTone } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/data";
import { Alert, EmptyState, Loading, PageError } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/form";

const ROLE_TONES: Record<UserRole, BadgeTone> = { admin: "violet", production: "accent", sales: "info" };

type Status =
  | { kind: "loading" }
  | { kind: "forbidden" }
  | { kind: "error"; message: string }
  | { kind: "ready"; currentUserId: string; users: PublicUser[] };

interface CreateForm {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

const BLANK_CREATE: CreateForm = { name: "", email: "", password: "", role: "sales" };

interface EditForm {
  name: string;
  email: string;
  role: UserRole;
  password: string;
}

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "Não foi possível conectar à API";
}

export default function UsersPage() {
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
    apiFetch<AuthUser>("/auth/me")
      .then((me) => {
        if (!active) return;
        if (me.role !== "admin") {
          setStatus({ kind: "forbidden" });
          return;
        }
        return apiFetch<PublicUser[]>("/users").then((users) => {
          if (active) setStatus({ kind: "ready", currentUserId: me.id, users });
        });
      })
      .catch((error: unknown) => {
        if (active) setStatus({ kind: "error", message: messageOf(error) });
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  function replaceUser(users: PublicUser[], updated: PublicUser): PublicUser[] {
    return users.map((user) => (user.id === updated.id ? updated : user));
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const created = await apiFetch<PublicUser>("/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      setStatus((current) =>
        current.kind === "ready" ? { ...current, users: [...current.users, created] } : current,
      );
      setCreateForm(BLANK_CREATE);
    } catch (error) {
      setCreateError(messageOf(error));
    } finally {
      setCreating(false);
    }
  }

  function startEdit(user: PublicUser) {
    setEditingId(user.id);
    setEditForm({ name: user.name, email: user.email, role: user.role, password: "" });
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
    setEditError(null);
  }

  async function saveEdit(user: PublicUser) {
    if (!editForm) return;
    const patch: Record<string, string> = {};
    if (editForm.name !== user.name) patch.name = editForm.name;
    if (editForm.email !== user.email) patch.email = editForm.email;
    if (editForm.role !== user.role) patch.role = editForm.role;
    if (editForm.password !== "") patch.password = editForm.password;

    setEditSubmitting(true);
    setEditError(null);
    try {
      const updated = await apiFetch<PublicUser>(`/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      setStatus((current) =>
        current.kind === "ready" ? { ...current, users: replaceUser(current.users, updated) } : current,
      );
      cancelEdit();
    } catch (error) {
      setEditError(messageOf(error));
    } finally {
      setEditSubmitting(false);
    }
  }

  async function toggleActive(user: PublicUser) {
    setToggling(user.id);
    setRowError((current) => ({ ...current, [user.id]: "" }));
    try {
      const updated = await apiFetch<PublicUser>(`/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !user.active }),
      });
      setStatus((current) =>
        current.kind === "ready" ? { ...current, users: replaceUser(current.users, updated) } : current,
      );
    } catch (error) {
      setRowError((current) => ({ ...current, [user.id]: messageOf(error) }));
    } finally {
      setToggling(null);
    }
  }

  function retry() {
    setAttempt((current) => current + 1);
  }

  if (status.kind === "forbidden") {
    return <p role="alert">Você não tem permissão para acessar esta página</p>;
  }

  if (status.kind === "loading") {
    return <Loading>Carregando usuários…</Loading>;
  }

  if (status.kind === "error") {
    return <PageError message={status.message} onRetry={retry} />;
  }

  const { currentUserId, users } = status;

  return (
    <>
      <Card title="Equipe" subtitle={`${users.length} ${users.length === 1 ? "usuário" : "usuários"}`}>
        {users.length === 0 ? (
          <EmptyState>Nenhum usuário cadastrado</EmptyState>
        ) : (
          <div className="bf-table-wrap">
            <table className="bf-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Papel</th>
                  <th>Situação</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isSelf = user.id === currentUserId;
                  const isEditing = editingId === user.id;
                  return (
                    <tr key={user.id} className={user.active ? undefined : "is-inactive"}>
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
                          <td data-label="E-mail">
                            <Field label="E-mail">
                              <Input
                                inputSize="sm"
                                value={editForm.email}
                                onChange={(event) => setEditForm({ ...editForm, email: event.target.value })}
                              />
                            </Field>
                          </td>
                          <td data-label="Papel">
                            {!isSelf && (
                              <Field label="Papel">
                                <Select
                                  selectSize="sm"
                                  value={editForm.role}
                                  onChange={(event) => setEditForm({ ...editForm, role: event.target.value as UserRole })}
                                >
                                  <option value="admin">Administrador</option>
                                  <option value="production">Produção</option>
                                  <option value="sales">Vendas</option>
                                </Select>
                              </Field>
                            )}
                          </td>
                          <td data-label="Situação">
                            <ActiveBadge active={user.active} />
                          </td>
                          <td className="bf-table__actions-cell">
                            <div className="flex flex-col gap-2">
                              <Field label="Nova senha">
                                <Input
                                  inputSize="sm"
                                  type="password"
                                  value={editForm.password}
                                  onChange={(event) => setEditForm({ ...editForm, password: event.target.value })}
                                />
                              </Field>
                              <div className="flex gap-2">
                                <Button size="sm" disabled={editSubmitting} onClick={() => saveEdit(user)}>
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
                          <td data-label="Nome">
                            <span className="flex items-center gap-2.5" style={{ fontWeight: 800 }}>
                              <Avatar name={user.name} size={32} />
                              {user.name}
                            </span>
                          </td>
                          <td data-label="E-mail">{user.email}</td>
                          <td data-label="Papel">
                            <Badge tone={ROLE_TONES[user.role]}>{ROLE_LABELS[user.role]}</Badge>
                          </td>
                          <td data-label="Situação">
                            <ActiveBadge active={user.active} />
                          </td>
                          <td className="bf-table__actions-cell">
                            <div className="flex flex-col items-end gap-1">
                              <div className="bf-table__actions">
                                <IconButton icon={Pencil} label="Editar" size="sm" onClick={() => startEdit(user)} />
                                {!isSelf && (
                                  <IconButton
                                    icon={Power}
                                    label={user.active ? "Desativar" : "Ativar"}
                                    size="sm"
                                    disabled={toggling === user.id}
                                    onClick={() => toggleActive(user)}
                                  />
                                )}
                              </div>
                              {rowError[user.id] && (
                                <p role="alert" className="bf-field__error" style={{ margin: 0 }}>
                                  {rowError[user.id]}
                                </p>
                              )}
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Novo usuário" icon={UserPlus}>
        <form onSubmit={submitCreate} className="flex flex-col gap-5">
          <div className="bf-form-grid">
            <Field label="Nome">
              <Input
                value={createForm.name}
                onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })}
              />
            </Field>
            <Field label="E-mail">
              <Input
                value={createForm.email}
                onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })}
              />
            </Field>
            <Field label="Senha">
              <Input
                type="password"
                value={createForm.password}
                onChange={(event) => setCreateForm({ ...createForm, password: event.target.value })}
              />
            </Field>
            <Field label="Papel">
              <Select
                value={createForm.role}
                onChange={(event) => setCreateForm({ ...createForm, role: event.target.value as UserRole })}
              >
                <option value="admin">Administrador</option>
                <option value="production">Produção</option>
                <option value="sales">Vendas</option>
              </Select>
            </Field>
          </div>
          {createError && (
            <Alert tone="danger" role="alert">
              {createError}
            </Alert>
          )}
          <div className="flex justify-end">
            <Button type="submit" loading={creating}>
              {creating ? "Criando…" : "Criar usuário"}
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
