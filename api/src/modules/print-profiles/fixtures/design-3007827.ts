import { readFileSync } from 'node:fs';

// Resposta real do MakerWorld (2026-09-21), reduzida aos campos usados e a três perfis.
// Cada chamada devolve uma cópia nova, que o teste pode alterar à vontade.
export function design3007827(): Record<string, unknown> {
  const url = new URL('../../../../test/fixtures/makerworld/design-3007827.json', import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8')) as Record<string, unknown>;
}
