import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { FormEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EntityForm, type FieldConfig } from "./entity-form";

interface WidgetForm {
  name: string;
  qty: string;
  urgent: boolean;
}

const FIELDS: FieldConfig<WidgetForm>[] = [
  { key: "name", label: "Nome" },
  { key: "qty", label: "Quantidade", type: "number" },
  { key: "urgent", label: "Urgente", type: "checkbox" },
];

describe("EntityForm", () => {
  afterEach(cleanup);

  it("renders fields, reports changes and reflects submitting/error state", () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());
    const values: WidgetForm = { name: "", qty: "0", urgent: false };

    const { rerender } = render(
      <EntityForm fields={FIELDS} values={values} onChange={onChange} onSubmit={onSubmit} submitting={false} error={null} />,
    );

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Parafuso" } });
    expect(onChange).toHaveBeenCalledWith({ ...values, name: "Parafuso" });

    fireEvent.click(screen.getByLabelText("Urgente"));
    expect(onChange).toHaveBeenCalledWith({ ...values, urgent: true });

    expect((screen.getByRole("button", { name: "Salvar" }) as HTMLButtonElement).disabled).toBe(false);

    rerender(
      <EntityForm
        fields={FIELDS}
        values={values}
        onChange={onChange}
        onSubmit={onSubmit}
        submitting={true}
        error="Falha ao salvar"
      />,
    );
    expect((screen.getByRole("button", { name: "Salvando…" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toBe("Falha ao salvar");
  });
});
