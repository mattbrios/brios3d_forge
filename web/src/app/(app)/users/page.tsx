"use client";

import { type FormEvent, useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import type { AuthUser, UserRole } from "@/lib/auth";
import { ROLE_LABELS, type PublicUser } from "@/lib/users";

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
    return <p>Carregando usuários…</p>;
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

  const { currentUserId, users } = status;

  return (
    <section className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Usuários</h1>

      {users.length === 0 ? (
        <p>Nenhum usuário cadastrado</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th>Nome</th>
              <th>E-mail</th>
              <th>Papel</th>
              <th>Situação</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isSelf = user.id === currentUserId;
              const isEditing = editingId === user.id;
              return (
                <tr key={user.id}>
                  {isEditing && editForm ? (
                    <>
                      <td>
                        <label>
                          Nome
                          <input
                            value={editForm.name}
                            onChange={(event) =>
                              setEditForm({ ...editForm, name: event.target.value })
                            }
                          />
                        </label>
                      </td>
                      <td>
                        <label>
                          E-mail
                          <input
                            value={editForm.email}
                            onChange={(event) =>
                              setEditForm({ ...editForm, email: event.target.value })
                            }
                          />
                        </label>
                      </td>
                      <td>
                        {!isSelf && (
                          <label>
                            Papel
                            <select
                              value={editForm.role}
                              onChange={(event) =>
                                setEditForm({ ...editForm, role: event.target.value as UserRole })
                              }
                            >
                              <option value="admin">Administrador</option>
                              <option value="production">Produção</option>
                              <option value="sales">Vendas</option>
                            </select>
                          </label>
                        )}
                      </td>
                      <td>{user.active ? "Ativo" : "Inativo"}</td>
                      <td>
                        <label>
                          Nova senha
                          <input
                            type="password"
                            value={editForm.password}
                            onChange={(event) =>
                              setEditForm({ ...editForm, password: event.target.value })
                            }
                          />
                        </label>
                        <button type="button" disabled={editSubmitting} onClick={() => saveEdit(user)}>
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
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>{ROLE_LABELS[user.role]}</td>
                      <td>{user.active ? "Ativo" : "Inativo"}</td>
                      <td>
                        <button type="button" onClick={() => startEdit(user)}>
                          Editar
                        </button>
                        {!isSelf && (
                          <button
                            type="button"
                            disabled={toggling === user.id}
                            onClick={() => toggleActive(user)}
                          >
                            {user.active ? "Desativar" : "Ativar"}
                          </button>
                        )}
                        {rowError[user.id] && <p role="alert">{rowError[user.id]}</p>}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <form onSubmit={submitCreate} className="flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Novo usuário</h2>
        <label>
          Nome
          <input
            value={createForm.name}
            onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })}
          />
        </label>
        <label>
          E-mail
          <input
            value={createForm.email}
            onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })}
          />
        </label>
        <label>
          Senha
          <input
            type="password"
            value={createForm.password}
            onChange={(event) => setCreateForm({ ...createForm, password: event.target.value })}
          />
        </label>
        <label>
          Papel
          <select
            value={createForm.role}
            onChange={(event) =>
              setCreateForm({ ...createForm, role: event.target.value as UserRole })
            }
          >
            <option value="admin">Administrador</option>
            <option value="production">Produção</option>
            <option value="sales">Vendas</option>
          </select>
        </label>
        {createError && <p role="alert">{createError}</p>}
        <button type="submit" disabled={creating}>
          {creating ? "Criando…" : "Criar usuário"}
        </button>
      </form>
    </section>
  );
}
