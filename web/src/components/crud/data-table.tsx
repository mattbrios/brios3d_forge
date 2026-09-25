import type { ReactNode } from "react";
import { cx } from "../ui/cx";

// Contrato reutilizável de listagem (door 3, Fase 6): as Fases 7-10 copiam este componente.
export interface Column<T> {
  key: keyof T & string;
  label: string;
  render?: (row: T) => ReactNode;
  // Alinha à direita com algarismos tabulares.
  numeric?: boolean;
}

// Tabela no desktop; abaixo de 640px de largura do contêiner cada linha vira um cartão (só CSS,
// a mesma árvore - nada é renderizado duas vezes).
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  renderActions,
  isInactive,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  renderActions?: (row: T) => ReactNode;
  // Linhas inativas saem em cinza.
  isInactive?: (row: T) => boolean;
}) {
  return (
    <div className="bf-table-wrap">
      <table className="bf-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.numeric ? "is-num" : undefined}>
                {column.label}
              </th>
            ))}
            {renderActions && <th aria-label="Ações" style={{ width: 1 }} />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowId(row)} className={cx(isInactive?.(row) && "is-inactive")}>
              {columns.map((column) => (
                <td key={column.key} className={column.numeric ? "is-num" : undefined} data-label={column.label}>
                  {column.render ? column.render(row) : String(row[column.key] ?? "")}
                </td>
              ))}
              {renderActions && (
                <td className="bf-table__actions-cell">
                  <div className="bf-table__actions">{renderActions(row)}</div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
