const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// Centavos inteiros em reais: 120000 -> "R$ 1.200,00".
export function formatCents(cents: number): string {
  return BRL.format(cents / 100);
}
