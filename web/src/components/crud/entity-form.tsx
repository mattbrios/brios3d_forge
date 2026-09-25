"use client";

import type { FormEvent } from "react";
import { Button } from "../ui/button";
import { Alert } from "../ui/feedback";
import { Checkbox, Field, Input } from "../ui/form";

// Contrato reutilizável de formulário (door 3, Fase 6): as Fases 7-10 copiam este componente.
export interface FieldConfig<V> {
  key: keyof V & string;
  label: string;
  type?: "text" | "number" | "checkbox";
  placeholder?: string;
}

export function EntityForm<V extends object>({
  fields,
  values,
  onChange,
  onSubmit,
  submitting,
  error,
  onCancel,
  cancelLabel = "Cancelar",
}: {
  fields: FieldConfig<V>[];
  values: V;
  onChange: (values: V) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitting: boolean;
  error: string | null;
  // Botão secundário ao lado do "Salvar" (ex.: "Cancelar edição").
  onCancel?: () => void;
  cancelLabel?: string;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="bf-form-grid">
        {fields.map((field) =>
          field.type === "checkbox" ? (
            <div key={field.key} className="flex items-end" style={{ paddingBottom: 8 }}>
              <Checkbox
                label={field.label}
                checked={Boolean(values[field.key])}
                onChange={(event) => onChange({ ...values, [field.key]: event.target.checked })}
              />
            </div>
          ) : (
            <Field key={field.key} label={field.label}>
              <Input
                type={field.type === "number" ? "number" : "text"}
                placeholder={field.placeholder}
                value={String(values[field.key] ?? "")}
                onChange={(event) => onChange({ ...values, [field.key]: event.target.value })}
              />
            </Field>
          ),
        )}
      </div>
      {error && (
        <Alert tone="danger" role="alert">
          {error}
        </Alert>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
        )}
        <Button type="submit" loading={submitting}>
          {submitting ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
