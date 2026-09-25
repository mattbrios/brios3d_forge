"use client";

import { type FormEvent, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";

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
    <div style={{ maxWidth: 560, width: "100%" }}>
      <Card title="Trocar senha" icon={Lock}>
        {status.kind === "done" && (
          <Alert tone="success" role="status">
            Senha alterada
          </Alert>
        )}
        <form onSubmit={submit} className="flex flex-col gap-5">
          <div className="bf-form-grid">
            <Field label="Senha atual" style={{ gridColumn: "1 / -1" }}>
              <Input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </Field>
            <Field label="Nova senha">
              <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
            </Field>
            <Field label="Confirmar nova senha">
              <Input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </Field>
          </div>
          {status.kind === "error" && (
            <Alert tone="danger" role="alert">
              {status.message}
            </Alert>
          )}
          <div className="flex justify-end">
            <Button type="submit" loading={status.kind === "saving"}>
              {status.kind === "saving" ? "Salvando…" : "Trocar senha"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
