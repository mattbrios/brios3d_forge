"use client";

import { type FormEvent, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";

type Status = { kind: "idle" } | { kind: "saving" } | { kind: "error"; message: string } | { kind: "done" };

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "Não foi possível conectar à API";
}

export default function AccountPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setStatus({ kind: "error", message: "As senhas não conferem" });
      return;
    }
    setStatus({ kind: "saving" });
    try {
      await apiFetch<void>("/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setStatus({ kind: "done" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setStatus({ kind: "error", message: messageOf(error) });
    }
  }

  return (
    <section className="flex max-w-sm flex-col gap-4">
      <h1 className="text-2xl font-semibold">Minha conta</h1>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label>
          Senha atual
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </label>
        <label>
          Nova senha
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </label>
        <label>
          Confirmar nova senha
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </label>
        {status.kind === "error" && <p role="alert">{status.message}</p>}
        {status.kind === "done" && <p role="status">Senha alterada</p>}
        <button type="submit" disabled={status.kind === "saving"}>
          {status.kind === "saving" ? "Salvando…" : "Trocar senha"}
        </button>
      </form>
    </section>
  );
}
