"use client";

import { type FormEvent, useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import type { Settings } from "@/lib/settings";

interface FieldsForm {
  energyTariffCentsPerKwh: string;
  laborCentsPerHour: string;
  defaultMarginRate: string;
  failureRate: string;
  purgeRate: string;
  maintenanceCentsPerHour: string;
  productiveHoursPerMonth: string;
}

type Status =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; role: AuthUser["role"]; settings: Settings; form: FieldsForm };

const FIELDS: Array<{ key: keyof FieldsForm; label: string }> = [
  { key: "energyTariffCentsPerKwh", label: "Tarifa de energia (centavos/kWh)" },
  { key: "laborCentsPerHour", label: "Hora de trabalho (centavos)" },
  { key: "defaultMarginRate", label: "Margem padrão" },
  { key: "failureRate", label: "% falha" },
  { key: "purgeRate", label: "% purga" },
  { key: "maintenanceCentsPerHour", label: "Manutenção (centavos/hora)" },
  { key: "productiveHoursPerMonth", label: "Horas produtivas/mês" },
];

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "Não foi possível conectar à API";
}

function formOf(settings: Settings): FieldsForm {
  return {
    energyTariffCentsPerKwh: String(settings.energyTariffCentsPerKwh),
    laborCentsPerHour: String(settings.laborCentsPerHour),
    defaultMarginRate: String(settings.defaultMarginRate),
    failureRate: String(settings.failureRate),
    purgeRate: String(settings.purgeRate),
    maintenanceCentsPerHour: String(settings.maintenanceCentsPerHour),
    productiveHoursPerMonth: String(settings.productiveHoursPerMonth),
  };
}

export default function SettingsPage() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    // Mesmo padrão de fetch-em-efeito de users/page.tsx (volta para "loading" ao repetir a
    // busca via retry); o lint só reclama aqui porque este componente é menor e o React
    // Compiler consegue analisá-lo por inteiro.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus({ kind: "loading" });
    Promise.all([apiFetch<AuthUser>("/auth/me"), apiFetch<Settings>("/settings")])
      .then(([me, settings]) => {
        if (active) setStatus({ kind: "ready", role: me.role, settings, form: formOf(settings) });
      })
      .catch((error: unknown) => {
        if (active) setStatus({ kind: "error", message: messageOf(error) });
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  function retry() {
    setAttempt((current) => current + 1);
  }

  function setField(key: keyof FieldsForm, value: string) {
    setStatus((current) =>
      current.kind === "ready" ? { ...current, form: { ...current.form, [key]: value } } : current,
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status.kind !== "ready") return;
    const { form } = status;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await apiFetch<Settings>("/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          energyTariffCentsPerKwh: Number(form.energyTariffCentsPerKwh),
          laborCentsPerHour: Number(form.laborCentsPerHour),
          defaultMarginRate: Number(form.defaultMarginRate),
          failureRate: Number(form.failureRate),
          purgeRate: Number(form.purgeRate),
          maintenanceCentsPerHour: Number(form.maintenanceCentsPerHour),
          productiveHoursPerMonth: Number(form.productiveHoursPerMonth),
        }),
      });
      setStatus((current) =>
        current.kind === "ready" ? { ...current, settings: updated, form: formOf(updated) } : current,
      );
    } catch (error) {
      setSaveError(messageOf(error));
    } finally {
      setSaving(false);
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

  const { role, settings, form } = status;
  const editable = role === "admin";

  return (
    <section className="flex max-w-xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Configurações</h1>

      {editable ? (
        <form onSubmit={submit} className="flex flex-col gap-3">
          {FIELDS.map(({ key, label }) => (
            <label key={key}>
              {label}
              <input value={form[key]} onChange={(event) => setField(key, event.target.value)} />
            </label>
          ))}
          {saveError && <p role="alert">{saveError}</p>}
          <button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </form>
      ) : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {FIELDS.map(({ key, label }) => (
            <div key={key} className="contents">
              <dt className="text-zinc-500">{label}</dt>
              <dd>{settings[key as keyof Settings] as number}</dd>
            </div>
          ))}
        </dl>
      )}

      {settings.fixedCostItems.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Custos fixos mensais</h2>
          <ul className="text-sm">
            {settings.fixedCostItems.map((item) => (
              <li key={item.id}>
                {item.name}: {item.monthlyCents}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
