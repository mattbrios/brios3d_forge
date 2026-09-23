const CPF_LENGTH = 11;
const CNPJ_LENGTH = 14;

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function hasAllSameDigits(digits: string): boolean {
  return digits.split('').every((digit) => digit === digits[0]);
}

function checkDigit(digits: string, weights: number[]): number {
  const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

function isValidCpf(digits: string): boolean {
  if (checkDigit(digits, [10, 9, 8, 7, 6, 5, 4, 3, 2]) !== Number(digits[9])) {
    return false;
  }
  return checkDigit(digits.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(digits[10]);
}

function isValidCnpj(digits: string): boolean {
  if (checkDigit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) !== Number(digits[12])) {
    return false;
  }
  return checkDigit(digits.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(digits[13]);
}

// Remove a formatação (pontos, traço, barra) e devolve só os dígitos, para gravar no banco (AC 2).
export function digitsOfDocument(value: string): string {
  return onlyDigits(value);
}

// CPF (11 dígitos) ou CNPJ (14 dígitos) com dígito verificador válido. Uma sequência de dígitos
// repetidos (ex.: "111.111.111-11") satisfaz a conta do dígito verificador mas nunca é um
// documento real, então é rejeitada explicitamente antes de calcular o dígito (AC 3, AC 26).
export function isValidDocument(value: string): boolean {
  const digits = onlyDigits(value);
  if (hasAllSameDigits(digits)) {
    return false;
  }
  if (digits.length === CPF_LENGTH) {
    return isValidCpf(digits);
  }
  if (digits.length === CNPJ_LENGTH) {
    return isValidCnpj(digits);
  }
  return false;
}
