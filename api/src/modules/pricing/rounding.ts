// Único lugar do módulo que arredonda para centavos (door 2 do plano da Fase 1).

// Ruído de ponto flutuante tolerado ao subir o preço para o centavo seguinte:
// 6400 / 0.64 dá 10000.000000000002, e isso não pode virar 10001.
const PRICE_EPSILON = 1e-6;

// Componentes de custo: meio para cima.
export function roundCost(cents: number): number {
  return Math.round(cents);
}

// Preço de venda: teto, para a margem nunca ficar abaixo da pedida.
export function roundPriceUp(cents: number): number {
  return Math.ceil(cents - PRICE_EPSILON);
}
