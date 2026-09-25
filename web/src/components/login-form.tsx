"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";
import { Lock, Mail } from "lucide-react";
import { Button } from "./ui/button";
import { Alert, Loading } from "./ui/feedback";
import { Field, Input } from "./ui/form";

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "Não foi possível conectar à API";
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quem já tem sessão não precisa do login.
  useEffect(() => {
    let active = true;
    apiFetch<AuthUser>("/auth/me")
      .then(() => {
        if (active) router.replace("/");
      })
      .catch(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch<AuthUser>("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      router.replace(safeNext(searchParams.get("next")));
    } catch (caught) {
      setError(messageOf(caught));
      setSubmitting(false);
    }
  }

  if (checking) {
    return <Loading />;
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="E-mail">
        <Input
          type="email"
          name="email"
          icon={Mail}
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="voce@brios3d.com.br"
        />
      </Field>
      <Field label="Senha">
        <Input
          type="password"
          name="password"
          icon={Lock}
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </Field>
      {error && (
        <Alert tone="danger" role="alert">
          {error}
        </Alert>
      )}
      <Button type="submit" size="lg" block loading={submitting}>
        {submitting ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
