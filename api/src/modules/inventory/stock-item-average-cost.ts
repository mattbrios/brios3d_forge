import type { MovementType } from './entities/inventory-movement.entity.js';

export interface MovementForAverageCost {
  id: string;
  type: MovementType;
  // Assinado, como no ledger: positivo entra, negativo sai.
  quantity: number;
  unitCostCents: number | null;
  createdAt: Date;
}

export interface StockItemLedgerState {
  balanceQuantity: number;
  avgCostCents: number | null;
}

// Door 5: média móvel ponderada (PMP) por replay do ledger, nunca armazenada (AD-024).
// Só `entrada` mexe na média - uma saída consome ao custo médio vigente e por definição não o
// altera. A ordem cronológica importa: a mesma entrada antes ou depois de um consumo dá médias
// diferentes, e é por isso que este fold é ordenado aqui em vez de depender da query.
// Devolve o saldo junto porque é o mesmo replay: o saldo materializado em `stock_items` é a
// versão incremental deste número, e ter os dois do mesmo fold torna a divergência observável.
export function computeStockItemAverageCost(movements: MovementForAverageCost[]): StockItemLedgerState {
  const ordered = [...movements].sort((a, b) => {
    const byCreatedAt = a.createdAt.getTime() - b.createdAt.getTime();
    return byCreatedAt !== 0 ? byCreatedAt : a.id.localeCompare(b.id);
  });

  let balanceQuantity = 0;
  let avgCostCents = 0;

  for (const movement of ordered) {
    if (movement.type === 'entrada') {
      const enteringQuantity = movement.quantity;
      const enteringCost = movement.unitCostCents ?? 0;
      const totalQuantity = balanceQuantity + enteringQuantity;
      if (totalQuantity > 0) {
        avgCostCents = (balanceQuantity * avgCostCents + enteringQuantity * enteringCost) / totalQuantity;
      }
      balanceQuantity = totalQuantity;
      continue;
    }
    // `consumo`, `perda` e `ajuste` mexem só no saldo; a média fica intacta.
    balanceQuantity += movement.quantity;
  }

  // Sem nada na prateleira não existe custo médio a informar.
  return { balanceQuantity, avgCostCents: balanceQuantity === 0 ? null : avgCostCents };
}
