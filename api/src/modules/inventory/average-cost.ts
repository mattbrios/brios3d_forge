export interface RollForAverageCost {
  balanceGrams: number;
  acquisitionCostCents: number;
  initialWeightGrams: number;
  discardedAt: Date | null;
}

// Door 4 do plano: média ponderada pelo saldo ATUAL dos rolos não descartados, nunca
// armazenada. Exclui rolos descartados e com saldo zero; null quando não sobra nenhum saldo.
export function computeAverageCostCentsPerGram(rolls: RollForAverageCost[]): number | null {
  const eligible = rolls.filter((roll) => roll.discardedAt === null && roll.balanceGrams > 0);
  const totalBalanceGrams = eligible.reduce((sum, roll) => sum + roll.balanceGrams, 0);
  if (totalBalanceGrams === 0) {
    return null;
  }
  const weightedCostCents = eligible.reduce(
    (sum, roll) => sum + (roll.balanceGrams * roll.acquisitionCostCents) / roll.initialWeightGrams,
    0,
  );
  return weightedCostCents / totalBalanceGrams;
}
