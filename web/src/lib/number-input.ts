// Entrada numérica dos formulários (door 1, issue #9): um único separador, ponto ou vírgula, e ele
// é sempre o decimal (`1.800` -> 1.8). Dinheiro é digitado em reais e enviado em centavos.

export type ParseResult = { ok: true; value: number | null } | { ok: false; reason: "format" | "decimals" };

const DECIMAL = /^(-?)(\d+)(?:[.,](\d+))?$/;

export function parseDecimal(text: string): ParseResult {
  const trimmed = text.trim();
  if (trimmed === "") return { ok: true, value: null };
  const match = DECIMAL.exec(trimmed);
  if (!match) return { ok: false, reason: "format" };
  const [, sign, whole, fraction = "0"] = match;
  return { ok: true, value: Number(`${sign}${whole}.${fraction}`) };
}

// Conta sobre os dígitos, sem multiplicar um float por 100 (door 3): `10,10` -> 1010 exato.
export function parseReaisToCents(text: string, maxDecimals = 2): ParseResult {
  const trimmed = text.trim();
  if (trimmed === "") return { ok: true, value: null };
  const match = DECIMAL.exec(trimmed);
  if (!match) return { ok: false, reason: "format" };
  const [, sign, whole, fraction = ""] = match;
  if (fraction.length > maxDecimals) return { ok: false, reason: "decimals" };
  const digits = Number(whole + fraction.padEnd(maxDecimals, "0"));
  const cents = digits / 10 ** (maxDecimals - 2);
  return { ok: true, value: sign === "-" ? -cents : cents };
}

// Preenchimento do formulário de edição: vírgula decimal e nenhum separador de milhar.
export function centsToReaisInput(cents: number, maxDecimals = 2): string {
  return new Intl.NumberFormat("pt-BR", {
    useGrouping: false,
    minimumFractionDigits: 2,
    maximumFractionDigits: maxDecimals,
  }).format(cents / 100);
}

export function decimalToInput(value: number): string {
  return new Intl.NumberFormat("pt-BR", { useGrouping: false, maximumFractionDigits: 20 }).format(value);
}

export interface NumberFieldSpec {
  // Nome do campo na mensagem, sem a unidade: "Peso inicial", não "Peso inicial (g)".
  label: string;
  text: string;
  // Dinheiro em reais, convertido para centavos com até `maxDecimals` casas (padrão 2).
  money?: boolean;
  maxDecimals?: number;
  required?: boolean;
}

type FieldValue<S> = S extends { required: true } ? number : number | null;

export type ReadNumbersResult<T extends Record<string, NumberFieldSpec>> =
  | { ok: true; values: { [K in keyof T]: FieldValue<T[K]> } }
  | { ok: false; message: string };

// Converte os campos na ordem em que foram declarados e para no primeiro inválido, com a
// mensagem que a tela mostra como erro do formulário, sem chamar a API.
export function readNumbers<const T extends Record<string, NumberFieldSpec>>(specs: T): ReadNumbersResult<T> {
  const values: Record<string, number | null> = {};
  for (const [key, spec] of Object.entries(specs)) {
    const maxDecimals = spec.maxDecimals ?? 2;
    const result = spec.money ? parseReaisToCents(spec.text, maxDecimals) : parseDecimal(spec.text);
    if (!result.ok) {
      const hint =
        result.reason === "decimals"
          ? `use no máximo ${maxDecimals} casas decimais`
          : "use ponto ou vírgula apenas como separador decimal";
      return { ok: false, message: `Valor inválido em ${spec.label}: ${hint}` };
    }
    if (result.value === null && spec.required) {
      return { ok: false, message: `Preencha ${spec.label}` };
    }
    values[key] = result.value;
  }
  return { ok: true, values: values as { [K in keyof T]: FieldValue<T[K]> } };
}
