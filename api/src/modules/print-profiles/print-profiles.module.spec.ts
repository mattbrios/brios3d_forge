import { Test } from '@nestjs/testing';
import { readFileSync } from 'node:fs';
import { HttpMakerWorldClient, MAKERWORLD_CLIENT } from './makerworld.client.js';
import { PrintProfilesModule } from './print-profiles.module.js';

describe('PrintProfilesModule', () => {
  it('wires the http client', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [PrintProfilesModule] }).compile();
    expect(moduleRef.get(MAKERWORLD_CLIENT)).toBeInstanceOf(HttpMakerWorldClient);

    // O AppModule monta o banco, então aqui só se confere que ele importa o módulo.
    const appModule = readFileSync(new URL('../../app.module.ts', import.meta.url), 'utf8');
    expect(appModule).toMatch(/imports:\s*\[[\s\S]*\bPrintProfilesModule\b[\s\S]*\]/);
  });
});
