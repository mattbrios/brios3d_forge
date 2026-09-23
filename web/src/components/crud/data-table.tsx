import type { ReactNode } from "react";

// Contrato reutilizável de listagem (door 3, Fase 6): as Fases 7-10 copiam este componente.
export interface Column<T> {
  key: keyof T & string;
  label: string;
  render?: (row: T) => ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  renderActions,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  renderActions?: (row: T) => ReactNode;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left">
          {columns.map((column) => (
            <th key={column.key}>{column.label}</th>
          ))}
          {renderActions && <th />}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={getRowId(row)}>
            {columns.map((column) => (
              <td key={column.key}>
                {column.render ? column.render(row) : String(row[column.key] ?? "")}
              </td>
            ))}
            {renderActions && <td>{renderActions(row)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
