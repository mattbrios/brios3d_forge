import { QueryFailedError } from 'typeorm';

const CHECK_VIOLATION = '23514';

// Backstop do CHECK (balance_grams >= 0) sob concorrência (door 3): a API captura o código
// 23514 do Postgres em vez de deixar vazar 500.
export function isCheckViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driverError: unknown = error.driverError;
  return (
    typeof driverError === 'object' &&
    driverError !== null &&
    (driverError as { code?: unknown }).code === CHECK_VIOLATION
  );
}
