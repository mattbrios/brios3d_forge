import { describe, expect, it } from 'vitest';
import { computeAverageCostCentsPerGram, type RollForAverageCost } from './average-cost.js';

function roll(overrides: Partial<RollForAverageCost> = {}): RollForAverageCost {
  return {
    balanceGrams: 1000,
    acquisitionCostCents: 10000,
    initialWeightGrams: 1000,
    discardedAt: null,
    ...overrides,
  };
}

describe('computeAverageCostCentsPerGram', () => {
  it('weights by remaining balance and excludes empty or discarded rolls', () => {
    // Dois rolos de custo diferente (caso de referência do ROADMAP via API, AC 9): 1000 g a
    // 10000 centavos (10/g) e 1000 g a 12000 centavos (12/g) -> média ponderada 11.
    expect(
      computeAverageCostCentsPerGram([
        roll({ acquisitionCostCents: 10000 }),
        roll({ acquisitionCostCents: 12000 }),
      ]),
    ).toBe(11);

    // Um único rolo: a média é o próprio custo por grama do rolo.
    expect(computeAverageCostCentsPerGram([roll({ acquisitionCostCents: 15000, initialWeightGrams: 500 })])).toBe(30);

    // Rolo com balanceGrams: 0 excluído do cálculo.
    expect(
      computeAverageCostCentsPerGram([
        roll({ acquisitionCostCents: 10000 }),
        roll({ acquisitionCostCents: 999999, balanceGrams: 0 }),
      ]),
    ).toBe(10);

    // Rolo com discardedAt setado excluído do cálculo.
    expect(
      computeAverageCostCentsPerGram([
        roll({ acquisitionCostCents: 10000 }),
        roll({ acquisitionCostCents: 999999, discardedAt: new Date('2026-01-01T00:00:00Z') }),
      ]),
    ).toBe(10);

    // Nenhum rolo -> null.
    expect(computeAverageCostCentsPerGram([])).toBeNull();
  });
});
