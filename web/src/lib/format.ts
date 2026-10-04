// Exibição pt-BR (door 1, issue #9). O `Intl` separa "R$" do valor com espaço não separável.
const MONEY = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const UNIT_MONEY = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});
const QUANTITY = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

// Centavos em reais com 2 casas: 180050 -> "R$ 1.800,50".
export function formatCents(cents: number): string {
  return MONEY.format(cents / 100);
}

// Custo de uma unidade (grama, kWh, peça), que cabe em até 4 casas: 12.34 -> "R$ 0,1234".
export function formatUnitCents(cents: number): string {
  return UNIT_MONEY.format(cents / 100);
}

export function formatCentsPerUnit(cents: number, unit: string): string {
  return `${formatUnitCents(cents)}/${unit}`;
}

// Gramas, horas, saldos e contagens: até 2 casas, sem zeros à direita, com milhar.
export function formatQuantity(value: number): string {
  return QUANTITY.format(value);
}
