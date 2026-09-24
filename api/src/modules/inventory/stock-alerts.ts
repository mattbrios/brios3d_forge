// Door 4 da Fase 11: uma lista só de alertas, com o tipo de dono em `kind` e a unidade em `unit`.
// Nada disto é persistido - o alerta é leitura derivada, no mesmo espírito do custo médio
// (AD-024).
export type StockAlertKind = 'material' | 'stock_item';

export interface StockAlert {
  kind: StockAlertKind;
  id: string;
  label: string;
  balance: number;
  minimum: number;
  unit: string;
}

// A unidade do material é sempre grama: o piso é definido sobre a soma dos rolos.
export const MATERIAL_ALERT_UNIT = 'g';

export interface MaterialAlertInput {
  id: string;
  type: string;
  brand: string;
  color: string;
  active: boolean;
  minimumStockGrams: number | null;
  balanceGrams: number;
}

export interface StockItemAlertInput {
  id: string;
  name: string;
  unitOfMeasure: string;
  active: boolean;
  minimumQuantity: number | null;
  balanceQuantity: number;
}

// Fração do piso que falta. Comparável entre grama e unidade, ao contrário da falta absoluta
// (300 g não é "pior" que 3 un).
function missingFraction(alert: StockAlert): number {
  return (alert.minimum - alert.balance) / alert.minimum;
}

// O piso é o valor aceitável, não um valor proibido: alerta só quando o saldo está
// ESTRITAMENTE abaixo dele. Piso `null` é "sem política de reposição" e dono inativo é o que
// não se compra mais - nenhum dos dois entra na lista.
function alertIf(
  kind: StockAlertKind,
  id: string,
  label: string,
  unit: string,
  balance: number,
  minimum: number | null,
  active: boolean,
): StockAlert | null {
  if (minimum === null || !active || balance >= minimum) {
    return null;
  }
  return { kind, id, label, balance, minimum, unit };
}

export function computeStockAlerts(input: {
  materials: MaterialAlertInput[];
  stockItems: StockItemAlertInput[];
}): StockAlert[] {
  const fromMaterials = input.materials.map((material) =>
    alertIf(
      'material',
      material.id,
      `${material.type} · ${material.brand} · ${material.color}`,
      MATERIAL_ALERT_UNIT,
      material.balanceGrams,
      material.minimumStockGrams,
      material.active,
    ),
  );
  const fromItems = input.stockItems.map((item) =>
    alertIf(
      'stock_item',
      item.id,
      item.name,
      item.unitOfMeasure,
      item.balanceQuantity,
      item.minimumQuantity,
      item.active,
    ),
  );

  return [...fromMaterials, ...fromItems]
    .filter((alert): alert is StockAlert => alert !== null)
    .sort((left, right) => {
      const byFraction = missingFraction(right) - missingFraction(left);
      // Empate resolvido por `label` crescente, para a ordem ser estável entre chamadas.
      return byFraction !== 0 ? byFraction : left.label.localeCompare(right.label, 'pt-BR');
    });
}
