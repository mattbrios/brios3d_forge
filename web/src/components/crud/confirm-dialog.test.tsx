import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./confirm-dialog";

describe("ConfirmDialog", () => {
  afterEach(cleanup);

  it("confirms, cancels and disables both while pending", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const { rerender } = render(
      <ConfirmDialog
        message="Desativar este item?"
        confirmLabel="Desativar"
        onConfirm={onConfirm}
        onCancel={onCancel}
        pending={false}
      />,
    );

    expect(screen.getByText("Desativar este item?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Desativar" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    rerender(
      <ConfirmDialog
        message="Desativar este item?"
        confirmLabel="Desativar"
        onConfirm={onConfirm}
        onCancel={onCancel}
        pending={true}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Desativar" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
