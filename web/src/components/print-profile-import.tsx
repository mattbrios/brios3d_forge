"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { formatPrintTime, splitPrintTime } from "@/lib/format-print-time";
import type { PrintProfile, PrintProfileImportResult } from "@/lib/print-profiles";

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
  const inputClass =
    "rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900";

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleImport} className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          URL do MakerWorld
          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://makerworld.com/pt/models/…#profileId-…"
            className={inputClass}
          />
        </label>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Importar
          </button>
          {loading && <span role="status">Importando…</span>}
        </div>
      </form>

      {status.kind === "error" && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {status.message}
        </p>
      )}
      {status.kind === "empty" && (
        <p role="status" className="text-sm">
          Este modelo não tem perfis de impressão no MakerWorld. Preencha os dados manualmente
        </p>
      )}

      {status.kind === "loaded" && (
        <div className="flex flex-col gap-1 text-sm">
          {status.result.model.title && (
            <p className="font-medium">{status.result.model.title}</p>
          )}
          {status.result.profiles.length > 1 ? (
            <label className="flex flex-col gap-1 font-medium">
              Perfil
              <select
                value={status.profileId}
                onChange={(event) => selectProfile(status.result, Number(event.target.value))}
                className={inputClass}
              >
                {status.result.profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profileLabel(profile)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p>{profileLabel(status.result.profiles[0])}</p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4 text-sm">
        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1">
            Horas
            <input
              inputMode="numeric"
              value={form.hours}
              onChange={(event) => setForm({ ...form, hours: event.target.value })}
              className={`${inputClass} w-20`}
            />
          </label>
          <label className="flex flex-col gap-1">
            Minutos
            <input
              inputMode="numeric"
              value={form.minutes}
              onChange={(event) => setForm({ ...form, minutes: event.target.value })}
              className={`${inputClass} w-20`}
            />
          </label>
          <label className="flex flex-col gap-1">
            Impressora
            <input
              value={form.printer}
              onChange={(event) => setForm({ ...form, printer: event.target.value })}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            Bico (mm)
            <input
              inputMode="decimal"
              value={form.nozzle}
              onChange={(event) => setForm({ ...form, nozzle: event.target.value })}
              className={`${inputClass} w-20`}
            />
          </label>
          <label className="flex items-center gap-2 self-end pb-1">
            <input
              type="checkbox"
              checked={form.needsAms}
              onChange={(event) => setForm({ ...form, needsAms: event.target.checked })}
            />
            Precisa de AMS
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="font-medium">Filamentos</h2>
          {form.filaments.map((row, index) => (
            <fieldset
              key={row.key}
              className="flex flex-wrap items-end gap-2 rounded border border-zinc-200 p-2 dark:border-zinc-800"
            >
              <legend className="px-1 text-xs text-zinc-500">Filamento {index + 1}</legend>
              <label className="flex flex-col gap-1">
                Slot
                <input
                  inputMode="numeric"
                  value={row.slot}
                  onChange={(event) => updateFilament(row.key, "slot", event.target.value)}
                  className={`${inputClass} w-16`}
                />
              </label>
              <label className="flex flex-col gap-1">
                Tipo
                <input
                  value={row.type}
                  onChange={(event) => updateFilament(row.key, "type", event.target.value)}
                  className={`${inputClass} w-24`}
                />
              </label>
              <label className="flex flex-col gap-1">
                Cor
                <span className="flex items-center gap-1">
                  <span
                    data-testid="color-swatch"
                    aria-hidden="true"
                    className="inline-block h-6 w-6 rounded border border-zinc-300 dark:border-zinc-700"
                    style={{
                      backgroundColor: HEX_COLOR.test(row.color) ? row.color : "transparent",
                    }}
                  />
                  <input
                    value={row.color}
                    onChange={(event) => updateFilament(row.key, "color", event.target.value)}
                    placeholder="#RRGGBB"
                    className={`${inputClass} w-24`}
                  />
                </span>
              </label>
              <label className="flex flex-col gap-1">
                Gramas
                <input
                  inputMode="decimal"
                  value={row.grams}
                  onChange={(event) => updateFilament(row.key, "grams", event.target.value)}
                  className={`${inputClass} w-20`}
                />
              </label>
              <label className="flex flex-col gap-1">
                Metros
                <input
                  inputMode="decimal"
                  value={row.meters}
                  onChange={(event) => updateFilament(row.key, "meters", event.target.value)}
                  className={`${inputClass} w-20`}
                />
              </label>
              <button
                type="button"
                onClick={() => removeFilament(row.key)}
                className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700"
              >
                Remover
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            onClick={addFilament}
            className="self-start rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700"
          >
            Adicionar filamento
          </button>
        </div>
      </div>
    </div>
  );
}
