import type { FormEvent } from "react";

// Contrato reutilizável de formulário (door 3, Fase 6): as Fases 7-10 copiam este componente.
export interface FieldConfig<V> {
  key: keyof V & string;
  label: string;
  type?: "text" | "number" | "checkbox";
}

export function EntityForm<V extends object>({
  fields,
  values,
  onChange,
  onSubmit,
  submitting,
  error,
}: {
  fields: FieldConfig<V>[];
  values: V;
  onChange: (values: V) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitting: boolean;
  error: string | null;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      {fields.map((field) => (
        <label key={field.key} className="flex flex-col gap-1 text-sm">
          {field.type === "checkbox" ? (
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(values[field.key])}
                onChange={(event) => onChange({ ...values, [field.key]: event.target.checked })}
              />
              {field.label}
            </span>
          ) : (
            <>
              {field.label}
              <input
                type={field.type === "number" ? "number" : "text"}
                value={String(values[field.key] ?? "")}
                onChange={(event) => onChange({ ...values, [field.key]: event.target.value })}
              />
            </>
          )}
        </label>
      ))}
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "Salvando…" : "Salvar"}
      </button>
    </form>
  );
}
