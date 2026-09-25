"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { formatPrintTime, splitPrintTime } from "@/lib/format-print-time";
import type { PrintProfile, PrintProfileImportResult } from "@/lib/print-profiles";
import {
  Box,
  Check,
  Download,
  Layers,
  Link as LinkIcon,
  Plus,
  Printer,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "./ui/badge";
import { Button, IconButton } from "./ui/button";
import { Card } from "./ui/card";
import { Alert } from "./ui/feedback";
import { Checkbox, Field, Input, Select } from "./ui/form";

// Licenças que proíbem uso comercial ganham destaque de aviso.
const NONCOMMERCIAL = /noncommercial|\bnc\b/i;

// Fase 12: forma que a calculadora precisa de cada linha, decimal já convertido (o formulário
// desta tela guarda tudo como texto para aceitar "7,5" digitado à mão).
export interface ImportedFilament {
  key: number;
  type: string;
  color: string;
  grams: number | null;
}

// Todos os campos são texto para aceitar o que o usuário digitar (ex.: "7,5"). Nesta fase o
// formulário não é salvo: a calculadora (Fase 12) vai consumi-lo.
interface FilamentRow {
  key: number;
  slot: string;
  type: string;
  color: string;
  grams: string;
  meters: string;
}

interface FormState {
  hours: string;
  minutes: string;
  needsAms: boolean;
  printer: string;
  nozzle: string;
  filaments: FilamentRow[];
}

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "empty" }
  | { kind: "loaded"; result: PrintProfileImportResult; profileId: number };

const BLANK_FORM: FormState = {
  hours: "",
  minutes: "",
  needsAms: false,
  printer: "",
  nozzle: "",
  filaments: [],
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function decimal(value: number | null): string {
  return value === null ? "" : String(value).replace(".", ",");
}

function profileLabel(profile: PrintProfile): string {
  const time = profile.printSeconds === null ? "—" : formatPrintTime(profile.printSeconds);
  const grams = profile.totalGrams === null ? "—" : `${decimal(profile.totalGrams)} g`;
  return `${profile.title ?? `Perfil ${profile.id}`} · ${time} · ${grams}`;
}

export function PrintProfileImport({
  onFilamentsChange,
}: {
  // Fase 12: a calculadora precisa saber, a cada mudança, o tempo de impressão (em horas
  // decimais) e a lista de filamentos, para preencher o mapeamento material->filamento.
  onFilamentsChange?: (filaments: ImportedFilament[], printHours: number | null) => void;
} = {}) {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [form, setForm] = useState<FormState>(BLANK_FORM);
  const nextKey = useRef(0);

  useEffect(() => {
    if (!onFilamentsChange) {
      return;
    }
    const filaments: ImportedFilament[] = form.filaments.map((row) => ({
      key: row.key,
      type: row.type,
      color: row.color,
      grams: row.grams === "" ? null : Number(row.grams.replace(",", ".")),
    }));
    const hours = Number(form.hours.replace(",", "."));
    const minutes = Number(form.minutes.replace(",", "."));
    const printHours = form.hours === "" && form.minutes === "" ? null : hours + minutes / 60;
    onFilamentsChange(filaments, printHours);
    // form é recriado a cada alteração de campo; comparar pelos próprios valores (via
    // JSON.stringify) evitaria o efeito rodar por referência, mas o array de filaments já muda
    // de identidade a cada edição, então rodar a cada render de form é o comportamento certo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  function formFromProfile(profile: PrintProfile): FormState {
    const time = profile.printSeconds === null ? null : splitPrintTime(profile.printSeconds);
    return {
      hours: time ? String(time.hours) : "",
      minutes: time ? String(time.minutes) : "",
      needsAms: profile.needsAms ?? false,
      printer: profile.printer.name ?? "",
      nozzle: decimal(profile.printer.nozzleDiameterMm),
      filaments: profile.filaments.map((filament) => ({
        key: nextKey.current++,
        slot: String(filament.slot),
        type: filament.type ?? "",
        color: filament.color ?? "",
        grams: decimal(filament.grams),
        meters: decimal(filament.meters),
      })),
    };
  }

  function selectProfile(result: PrintProfileImportResult, profileId: number) {
    const profile = result.profiles.find((item) => item.id === profileId);
    if (profile) {
      setStatus({ kind: "loaded", result, profileId });
      setForm(formFromProfile(profile));
    }
  }

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: "loading" });
    try {
      const result = await apiFetch<PrintProfileImportResult>("/print-profiles/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const profileId = result.selectedProfileId ?? result.profiles[0]?.id;
      if (profileId === undefined) {
        setStatus({ kind: "empty" });
        setForm(BLANK_FORM);
        return;
      }
      selectProfile(result, profileId);
    } catch (error: unknown) {
      setStatus({
        kind: "error",
        message: error instanceof ApiError ? error.message : "Erro inesperado",
      });
      setForm(BLANK_FORM);
    }
  }

  function updateFilament(key: number, field: keyof Omit<FilamentRow, "key">, value: string) {
    setForm((current) => ({
      ...current,
      filaments: current.filaments.map((row) =>
        row.key === key ? { ...row, [field]: value } : row,
      ),
    }));
  }

  function addFilament() {
    setForm((current) => ({
      ...current,
      filaments: [
        ...current.filaments,
        { key: nextKey.current++, slot: "", type: "", color: "", grams: "", meters: "" },
      ],
    }));
  }

  function removeFilament(key: number) {
    setForm((current) => ({
      ...current,
      filaments: current.filaments.filter((row) => row.key !== key),
    }));
  }

  const loading = status.kind === "loading";
  const model = status.kind === "loaded" ? status.result.model : null;
  const totalGrams = form.filaments.reduce((sum, row) => sum + (Number(row.grams.replace(",", ".")) || 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <form onSubmit={handleImport} className="flex flex-wrap items-end gap-3">
          <Field label="URL do MakerWorld" style={{ flex: "1 1 320px" }}>
            <Input
              type="url"
              icon={LinkIcon}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://makerworld.com/pt/models/…#profileId-…"
            />
          </Field>
          <Button type="submit" variant="accent" icon={Download} loading={loading}>
            Importar
          </Button>
        </form>
        {loading && (
          <p role="status" className="bf-loading" style={{ margin: 0 }}>
            Importando…
          </p>
        )}
        {status.kind === "error" && (
          <Alert tone="danger" role="alert">
            {status.message}
          </Alert>
        )}
        {status.kind === "empty" && (
          <Alert tone="warning" role="status">
            Este modelo não tem perfis de impressão no MakerWorld. Preencha os dados manualmente
          </Alert>
        )}
      </Card>

      {status.kind === "loaded" && model && (
        <Card variant="flat">
          <div className="flex flex-wrap items-start gap-4">
            <div
              className="grid flex-none place-items-center overflow-hidden"
              style={{ width: 96, height: 96, borderRadius: 10, background: "var(--ink-100)", color: "var(--ink-400)" }}
            >
              {model.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- capa remota do MakerWorld
                <img src={model.coverUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <Box size={32} aria-hidden="true" />
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-2" style={{ flex: "1 1 240px" }}>
              {model.title && <p style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{model.title}</p>}
              {(model.designer || model.license) && (
                <div className="flex flex-wrap items-center gap-2">
                  {model.designer && (
                    <span className="bf-muted" style={{ fontSize: 13, fontWeight: 600 }}>
                      por {model.designer}
                    </span>
                  )}
                  {model.license && (
                    <Badge
                      tone={NONCOMMERCIAL.test(model.license) ? "warning" : "success"}
                      icon={NONCOMMERCIAL.test(model.license) ? TriangleAlert : Check}
                    >
                      {model.license}
                    </Badge>
                  )}
                </div>
              )}
              {status.result.profiles.length > 1 ? (
                <Field label="Perfil">
                  <Select
                    value={status.profileId}
                    onChange={(event) => selectProfile(status.result, Number(event.target.value))}
                  >
                    {status.result.profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profileLabel(profile)}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <p style={{ margin: 0, fontWeight: 600 }}>{profileLabel(status.result.profiles[0])}</p>
              )}
            </div>
          </div>
        </Card>
      )}

      <Card title="Dados de impressão" icon={Printer}>
        <div className="bf-form-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,130px),1fr))" }}>
          <Field label="Horas">
            <Input
              inputMode="numeric"
              value={form.hours}
              onChange={(event) => setForm({ ...form, hours: event.target.value })}
            />
          </Field>
          <Field label="Minutos">
            <Input
              inputMode="numeric"
              value={form.minutes}
              onChange={(event) => setForm({ ...form, minutes: event.target.value })}
            />
          </Field>
          <Field label="Impressora" style={{ gridColumn: "span 2" }}>
            <Input value={form.printer} onChange={(event) => setForm({ ...form, printer: event.target.value })} />
          </Field>
          <Field label="Bico (mm)">
            <Input
              inputMode="decimal"
              value={form.nozzle}
              onChange={(event) => setForm({ ...form, nozzle: event.target.value })}
            />
          </Field>
          <div className="flex items-end" style={{ paddingBottom: 8 }}>
            <Checkbox
              label="Precisa de AMS"
              checked={form.needsAms}
              onChange={(event) => setForm({ ...form, needsAms: event.target.checked })}
            />
          </div>
        </div>
      </Card>

      <Card
        title="Filamentos"
        icon={Layers}
        subtitle={
          form.filaments.length
            ? `${form.filaments.length} cor(es) · ${decimal(Math.round(totalGrams * 100) / 100)} g no total`
            : "Nenhum filamento"
        }
        action={
          <Button size="sm" variant="secondary" icon={Plus} onClick={addFilament}>
            Adicionar filamento
          </Button>
        }
      >
        {form.filaments.map((row, index) => (
          <fieldset
            key={row.key}
            className="grid items-end gap-3"
            style={{
              margin: 0,
              border: "1px solid var(--border-subtle)",
              borderRadius: 10,
              padding: 14,
              gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,110px),1fr))",
            }}
          >
            <legend className="bf-muted" style={{ padding: "0 6px", fontSize: 12, fontWeight: 800 }}>
              Filamento {index + 1}
            </legend>
            <Field label="Slot">
              <Input
                inputMode="numeric"
                value={row.slot}
                onChange={(event) => updateFilament(row.key, "slot", event.target.value)}
              />
            </Field>
            <Field label="Tipo">
              <Input value={row.type} onChange={(event) => updateFilament(row.key, "type", event.target.value)} />
            </Field>
            <Field label="Cor">
              <span className="flex items-center gap-2">
                <span
                  data-testid="color-swatch"
                  aria-hidden="true"
                  className="bf-swatch__chip"
                  style={{
                    width: 28,
                    height: 28,
                    flex: "none",
                    backgroundColor: HEX_COLOR.test(row.color) ? row.color : "transparent",
                    backgroundImage: HEX_COLOR.test(row.color)
                      ? undefined
                      : "repeating-linear-gradient(45deg,var(--ink-100) 0 4px,var(--ink-200) 4px 8px)",
                  }}
                />
                <Input
                  value={row.color}
                  onChange={(event) => updateFilament(row.key, "color", event.target.value)}
                  placeholder="#RRGGBB"
                />
              </span>
            </Field>
            <Field label="Gramas">
              <Input
                inputMode="decimal"
                value={row.grams}
                onChange={(event) => updateFilament(row.key, "grams", event.target.value)}
              />
            </Field>
            <Field label="Metros">
              <Input
                inputMode="decimal"
                value={row.meters}
                onChange={(event) => updateFilament(row.key, "meters", event.target.value)}
              />
            </Field>
            <div className="flex justify-end">
              <IconButton icon={Trash2} label="Remover" variant="outline" onClick={() => removeFilament(row.key)} />
            </div>
          </fieldset>
        ))}
      </Card>
    </div>
  );
}
