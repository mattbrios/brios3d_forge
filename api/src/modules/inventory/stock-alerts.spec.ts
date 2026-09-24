import {
  computeStockAlerts,
  type MaterialAlertInput,
  type StockAlert,
  type StockItemAlertInput,
} from './stock-alerts.js';

function material(overrides: Partial<MaterialAlertInput> = {}): MaterialAlertInput {
  return {
    id: 'mat-1',
    type: 'PLA',
    brand: 'Voolt',
    color: 'Preto',
    active: true,
    minimumStockGrams: 1000,
    balanceGrams: 800,
    ...overrides,
  };
}

function stockItem(overrides: Partial<StockItemAlertInput> = {}): StockItemAlertInput {
  return {
    id: 'item-1',
    name: 'Ímã 6x3',
    unitOfMeasure: 'un',
    active: true,
    minimumQuantity: 10,
    balanceQuantity: 4,
    ...overrides,
  };
}

const MATERIAL_800_OF_1000: StockAlert = {
  kind: 'material',
  id: 'mat-1',
  label: 'PLA · Voolt · Preto',
  balance: 800,
  minimum: 1000,
  unit: 'g',
};

const ITEM_4_OF_10: StockAlert = {
  kind: 'stock_item',
  id: 'item-1',
  label: 'Ímã 6x3',
  balance: 4,
  minimum: 10,
  unit: 'un',
};

// Uma linha por decisão do fold: o limite (os dois lados), os quatro motivos de exclusão, a
// unidade por tipo de dono, a ordem, o desempate e a entrada vazia. Os valores esperados vêm do
// plano, escritos literalmente aqui.
const CASES: Array<{
  name: string;
  input: { materials: MaterialAlertInput[]; stockItems: StockItemAlertInput[] };
  expected: StockAlert[];
}> = [
  {
    name: 'saldo abaixo do piso entra',
    input: { materials: [material({ balanceGrams: 800 })], stockItems: [] },
    expected: [MATERIAL_800_OF_1000],
  },
  {
    name: 'saldo igual ao piso fica fora',
    input: { materials: [material({ balanceGrams: 1000 })], stockItems: [] },
    expected: [],
  },
  {
    name: 'saldo acima do piso fica fora',
    input: { materials: [material({ balanceGrams: 1001 })], stockItems: [] },
    expected: [],
  },
  {
    name: 'piso null fica fora, mesmo com saldo zero',
    input: { materials: [material({ minimumStockGrams: null, balanceGrams: 0 })], stockItems: [] },
    expected: [],
  },
  {
    name: 'dono inativo fica fora, material e item',
    input: {
      materials: [material({ active: false, balanceGrams: 0 })],
      stockItems: [stockItem({ active: false, balanceQuantity: 0 })],
    },
    expected: [],
  },
  {
    name: 'saldo zero com piso definido entra',
    input: { materials: [material({ minimumStockGrams: 500, balanceGrams: 0 })], stockItems: [] },
    expected: [
      { kind: 'material', id: 'mat-1', label: 'PLA · Voolt · Preto', balance: 0, minimum: 500, unit: 'g' },
    ],
  },
  {
    name: 'a unidade é grama no material e a unidade de medida no item',
    input: { materials: [material()], stockItems: [stockItem()] },
    expected: [ITEM_4_OF_10, MATERIAL_800_OF_1000],
  },
  {
    name: 'a ordem sai pela fração da falta decrescente, não pela falta absoluta',
    input: {
      materials: [
        material({ balanceGrams: 800 }),
        material({ id: 'mat-2', color: 'Branco', minimumStockGrams: 500, balanceGrams: 0 }),
      ],
      stockItems: [stockItem()],
    },
    expected: [
      { kind: 'material', id: 'mat-2', label: 'PLA · Voolt · Branco', balance: 0, minimum: 500, unit: 'g' },
      ITEM_4_OF_10,
      MATERIAL_800_OF_1000,
    ],
  },
  {
    name: 'o empate na fração sai por label crescente',
    input: {
      materials: [],
      stockItems: [
        stockItem({ id: 'item-z', name: 'Zinco', balanceQuantity: 5 }),
        stockItem({ id: 'item-a', name: 'Alumínio', balanceQuantity: 5 }),
      ],
    },
    expected: [
      { kind: 'stock_item', id: 'item-a', label: 'Alumínio', balance: 5, minimum: 10, unit: 'un' },
      { kind: 'stock_item', id: 'item-z', label: 'Zinco', balance: 5, minimum: 10, unit: 'un' },
    ],
  },
  {
    name: 'entrada vazia devolve lista vazia',
    input: { materials: [], stockItems: [] },
    expected: [],
  },
];

describe('computeStockAlerts', () => {
  it('turns balances and minimums into an ordered alert list', () => {
    for (const testCase of CASES) {
      expect(computeStockAlerts(testCase.input), testCase.name).toEqual(testCase.expected);
    }
  });
});
