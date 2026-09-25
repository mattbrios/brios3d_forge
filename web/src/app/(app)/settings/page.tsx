"use client";

import { type FormEvent, useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import type { Settings } from "@/lib/settings";
import { Calculator, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, Loading, PageError } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { formatCents } from "@/lib/format";

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
    return <Loading />;
  }

  if (status.kind === "error") {
    return <PageError message={status.message} onRetry={retry} />;
  }

  const { role, settings, form } = status;
  const editable = role === "admin";
  const fixedTotal = settings.fixedCostItems.reduce((sum, item) => sum + item.monthlyCents, 0);

  return (
    <div
      className="bf-grid-2"
      style={{ alignItems: "start", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,380px),1fr))" }}
    >
      <Card title="Parâmetros da calculadora" icon={Calculator} subtitle="Usados em todo orçamento">
        {editable ? (
          <form onSubmit={submit} className="flex flex-col gap-5">
            <div className="bf-form-grid">
              {FIELDS.map(({ key, label }) => (
                <Field key={key} label={label}>
                  <Input value={form[key]} onChange={(event) => setField(key, event.target.value)} />
                </Field>
              ))}
            </div>
            {saveError && (
              <Alert tone="danger" role="alert">
                {saveError}
              </Alert>
            )}
            <div className="flex justify-end">
              <Button type="submit" loading={saving}>
                {saving ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </form>
        ) : (
          <dl className="bf-dl">
            {FIELDS.map(({ key, label }) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>{settings[key as keyof Settings] as number}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>

      {settings.fixedCostItems.length > 0 && (
        <Card title="Custos fixos mensais" icon={ReceiptText}>
          <ul className="flex flex-col" style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {settings.fixedCostItems.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2.5"
                style={{ padding: "12px 0", borderBottom: "1px solid var(--border-subtle)" }}
              >
                <span style={{ flex: 1, fontWeight: 700 }}>{item.name}</span>
                <span className="bf-num" style={{ fontWeight: 800 }}>
                  {formatCents(item.monthlyCents)}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between" style={{ fontWeight: 800 }}>
            <span>Total</span>
            <span className="bf-num" style={{ color: "var(--forge-orange-600)", fontSize: 18 }}>
              {formatCents(fixedTotal)}
            </span>
          </div>
        </Card>
      )}
    </div>
  );
}
