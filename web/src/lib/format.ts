// Centavos inteiros em reais, no mesmo formato do resto do app: 1050 -> "R$ 10.50".
export function formatCents(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2)}`;
}
