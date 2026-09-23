import { describe, expect, it } from 'vitest';
import { computeStockItemAverageCost, type MovementForAverageCost } from './stock-item-average-cost.js';

// Cada movimento ganha um instante crescente, para o fold ordenar pelo mesmo critério do ledger.
function ledger(
  entries: Array<{
    type: MovementForAverageCost['type'];
    quantity: number;
    unitCostCents?: number | null;
    at?: string;
    id?: string;
  }>,
): MovementForAverageCost[] {
  return entries.map((entry, index) => ({
    id: entry.id ?? `mv-${index + 1}`,
    type: entry.type,
    quantity: entry.quantity,
    unitCostCents: entry.unitCostCents ?? null,
    createdAt: new Date(entry.at ?? `2026-01-0${index + 1}T00:00:00.000Z`),
  }));
}

describe('computeStockItemAverageCost', () => {
  it('folds the ledger into a moving weighted average', () => {
    // Sequência de referência do plano (AC 14-16): +100@50, +100@70 -> média 60; consumo de 150
    // não mexe na média; +50@100 sobre o saldo remanescente de 50 -> (50×60 + 50×100)/100 = 80.
    expect(
      computeStockItemAverageCost(
        ledger([
          { type: 'entrada', quantity: 100, unitCostCents: 50 },
          { type: 'entrada', quantity: 100, unitCostCents: 70 },
          { type: 'consumo', quantity: -150 },
          { type: 'entrada', quantity: 50, unitCostCents: 100 },
        ]),
      ),
    ).toEqual({ balanceQuantity: 100, avgCostCents: 80 });

    // `ajuste` positivo (contagem achou mais do que o sistema): saldo sobe, média intacta.
    expect(
      computeStockItemAverageCost(
        ledger([
          { type: 'entrada', quantity: 100, unitCostCents: 50 },
          { type: 'ajuste', quantity: 20 },
        ]),
      ),
    ).toEqual({ balanceQuantity: 120, avgCostCents: 50 });

    // `ajuste` negativo: saldo cai, média intacta.
    expect(
      computeStockItemAverageCost(
        ledger([
          { type: 'entrada', quantity: 100, unitCostCents: 50 },
          { type: 'ajuste', quantity: -20 },
        ]),
      ),
    ).toEqual({ balanceQuantity: 80, avgCostCents: 50 });

    // `perda`: saldo cai, média intacta.
    expect(
      computeStockItemAverageCost(
        ledger([
          { type: 'entrada', quantity: 100, unitCostCents: 50 },
          { type: 'perda', quantity: -40 },
        ]),
      ),
    ).toEqual({ balanceQuantity: 60, avgCostCents: 50 });

    // Entrada depois do saldo zerar: a média é o custo da entrada nova, sem herdar a antiga.
    expect(
      computeStockItemAverageCost(
        ledger([
          { type: 'entrada', quantity: 100, unitCostCents: 50 },
          { type: 'consumo', quantity: -100 },
          { type: 'entrada', quantity: 10, unitCostCents: 250 },
        ]),
      ),
    ).toEqual({ balanceQuantity: 10, avgCostCents: 250 });

    // Duas entradas com o mesmo `createdAt`, nas duas ordens de entrada: mesmo resultado.
    const sameInstant = [
      { type: 'entrada' as const, quantity: 100, unitCostCents: 50, at: '2026-02-01T00:00:00.000Z', id: 'a' },
      { type: 'entrada' as const, quantity: 300, unitCostCents: 90, at: '2026-02-01T00:00:00.000Z', id: 'b' },
    ];
    const forward = computeStockItemAverageCost(ledger(sameInstant));
    const reversed = computeStockItemAverageCost(ledger([...sameInstant].reverse()));
    expect(forward).toEqual({ balanceQuantity: 400, avgCostCents: 80 });
    expect(reversed).toEqual(forward);

    // Ledger vazio: item recém-cadastrado (door 6) não tem custo médio a informar.
    expect(computeStockItemAverageCost([])).toEqual({ balanceQuantity: 0, avgCostCents: null });
  });
});
