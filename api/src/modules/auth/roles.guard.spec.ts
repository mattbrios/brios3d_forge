import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
// A matriz do ROADMAP.md preenche @Roles() só nestes controllers (door 1).
const EXPECTED = new Set([
  'auth.controller.ts',
  'customers.controller.ts',
  'inventory.controller.ts',
  'materials.controller.ts',
  'pricing.controller.ts',
  'printers.controller.ts',
  'print-profiles.controller.ts',
  // Fase 13: leitura do catálogo para production e sales.
  'products.controller.ts',
  'sales-channels.controller.ts',
  'settings.controller.ts',
  'suppliers.controller.ts',
]);

function controllerFilesWithRolesDecorator(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...controllerFilesWithRolesDecorator(path));
      continue;
    }
    if (!entry.name.endsWith('.controller.ts')) {
      continue;
    }
    const usesDecorator = readFileSync(path, 'utf8')
      .split('\n')
      .some((line) => /^\s*@Roles\(/.test(line));
    if (usesDecorator) {
      found.push(entry.name);
    }
  }
  return found;
}

describe('RolesGuard usage', () => {
  it('roles decorator is used where documented', () => {
    const files = new Set(controllerFilesWithRolesDecorator(SRC_DIR));
    expect(files).toEqual(EXPECTED);
  });
});
