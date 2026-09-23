import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataTable, type Column } from "./data-table";

interface Widget {
  id: string;
  name: string;
  qty: number;
}

const ROWS: Widget[] = [
  { id: "w1", name: "Parafuso", qty: 10 },
  { id: "w2", name: "Porca", qty: 3 },
];

describe("DataTable", () => {
  afterEach(cleanup);

  it("renders columns and rows with a custom cell render", () => {
    const renderActions = vi.fn((row: Widget) => <button type="button">Ação {row.id}</button>);
    const columns: Column<Widget>[] = [
      { key: "name", label: "Nome" },
      { key: "qty", label: "Quantidade", render: (row) => `${row.qty} un.` },
    ];

    render(<DataTable columns={columns} rows={ROWS} getRowId={(row) => row.id} renderActions={renderActions} />);

    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(3);

    expect(within(rows[1]).getByText("Parafuso")).toBeTruthy();
    expect(within(rows[1]).getByText("10 un.")).toBeTruthy();
    expect(within(rows[2]).getByText("Porca")).toBeTruthy();
    expect(within(rows[2]).getByText("3 un.")).toBeTruthy();

    expect(renderActions).toHaveBeenCalledTimes(2);
    expect(within(rows[1]).getByRole("button", { name: "Ação w1" })).toBeTruthy();
    expect(within(rows[2]).getByRole("button", { name: "Ação w2" })).toBeTruthy();
  });
});
