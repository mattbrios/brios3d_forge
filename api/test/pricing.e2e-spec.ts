import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { r1 } from '../src/modules/pricing/fixtures/r1.js';
import { createUser, deleteUsers, loginCookie } from './auth-helper.js';

type Json = Record<string, unknown>;

// Troca o valor num caminho como "materials.0.grams" de uma cópia do R1.
function withValue(path: string, value: unknown): Json {
  const body = structuredClone(r1()) as unknown as Json;
  const keys = path.split('.');
  let target: Json = body;
  for (const key of keys.slice(0, -1)) {
    target = target[key] as Json;
  }
  target[keys[keys.length - 1]] = value;
  return body;
}

describe('POST /pricing/calculate (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  // Desde a Fase 3 a rota exige sessão.
  let cookie: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    dataSource = app.get(DataSource);
    await deleteUsers(dataSource, ['pricing-e2e@test.local']);
    await createUser(dataSource, { email: 'pricing-e2e@test.local' });
    cookie = await loginCookie(app.getHttpServer(), 'pricing-e2e@test.local');
  });

  afterAll(async () => {
    await deleteUsers(dataSource, ['pricing-e2e@test.local']);
    await app.close();
  });

  const post = (body: unknown) =>
    request(app.getHttpServer()).post('/pricing/calculate').set('Cookie', cookie).send(body as object);

  const errorOf = (response: { body: unknown }): string => (response.body as { error: string }).error;

  it('R1 returns the full breakdown', async () => {
    const response = await post(r1());
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      quantity: 1,
      costs: {
        materialCents: 1050,
        energyCents: 100,
        depreciationCents: 400,
        maintenanceCents: 250,
        laborCents: 3000,
        suppliesCents: 300,
        fixedCostsCents: 1000,
        directCostCents: 6100,
        costWithRiskCents: 6710,
      },
      channels: [
        { name: 'Balcão', unitPriceCents: 10485, totalPriceCents: 10485, minimumPriceApplied: false },
        {
          name: 'Mercado Livre',
          unitPriceCents: 13980,
          totalPriceCents: 13980,
          minimumPriceApplied: false,
        },
      ],
    });
  });

  it('domain errors return 400', async () => {
    const rates = r1();
    rates.marginRate = 0.5;
    rates.taxRate = 0.3;
    rates.channels = [{ name: 'Balcão', feeRate: 0.2 }];
    const ratesResponse = await post(rates);
    expect(ratesResponse.status).toBe(400);
    expect(ratesResponse.body).toEqual({
      error: 'Channel "Balcão": margin + taxes + fee must be below 100%',
    });

    const duplicate = r1();
    duplicate.channels = [
      { name: 'Balcão', feeRate: 0 },
      { name: 'Balcão', feeRate: 0 },
    ];
    const duplicateResponse = await post(duplicate);
    expect(duplicateResponse.status).toBe(400);
    expect(duplicateResponse.body).toEqual({ error: 'Duplicate channel name: "Balcão"' });
  });

  const numericFields = [
    'printHours',
    'materials.0.grams',
    'materials.0.costPerGramCents',
    'printer.powerWatts',
    'printer.costCents',
    'printer.lifespanHours',
    'energyTariffCentsPerKwh',
    'maintenanceCentsPerHour',
    'labor.prepHours',
    'labor.slicingHours',
    'labor.postProcessingHours',
    'labor.centsPerHour',
    'supplies.0.quantity',
    'supplies.0.unitCostCents',
    'fixedCosts.monthlyCents',
    'fixedCosts.productiveHoursPerMonth',
    'purgeRate',
    'failureRate',
    'marginRate',
    'taxRate',
    'minimumOrderCents',
    'channels.0.feeRate',
  ];

  it('negative numeric field returns 400', async () => {
    expect(numericFields).toHaveLength(22);
    for (const path of numericFields) {
      const response = await post(withValue(path, -1));
      const name = path.split('.').pop() as string;
      expect(response.status, path).toBe(400);
      expect(errorOf(response), path).toContain(name);
    }
  });

  it('quantity must be a positive integer', async () => {
    for (const value of [0, 1.5, 'abc']) {
      const response = await post(withValue('quantity', value));
      expect(response.status, String(value)).toBe(400);
      expect(errorOf(response)).toContain('quantity');
    }
    expect((await post(withValue('quantity', 1))).status).toBe(200);
  });

  it('zero divisors return 400', async () => {
    for (const path of ['printer.lifespanHours', 'fixedCosts.productiveHoursPerMonth']) {
      const response = await post(withValue(path, 0));
      expect(response.status, path).toBe(400);
      expect(errorOf(response)).toContain(path.split('.').pop() as string);
      expect((await post(withValue(path, 0.1))).status, path).toBe(200);
    }
  });

  it('rate upper bounds', async () => {
    for (const path of ['purgeRate', 'failureRate']) {
      const over = await post(withValue(path, 1.01));
      expect(over.status, path).toBe(400);
      expect(errorOf(over)).toContain(path);
      expect((await post(withValue(path, 1))).status, path).toBe(200);
    }
    for (const path of ['marginRate', 'taxRate', 'channels.0.feeRate']) {
      const response = await post(withValue(path, 1));
      expect(response.status, path).toBe(400);
      expect(errorOf(response)).toContain(path.split('.').pop() as string);
    }
  });

  it('empty materials or channels return 400', async () => {
    for (const path of ['materials', 'channels']) {
      const response = await post(withValue(path, []));
      expect(response.status, path).toBe(400);
      expect(errorOf(response)).toContain(path);
    }
  });

  it('array size limits', async () => {
    const material = { grams: 1, costPerGramCents: 1 };
    const supply = { quantity: 1, unitCostCents: 1 };
    const channels = (count: number) =>
      Array.from({ length: count }, (_, index) => ({ name: `canal ${index}`, feeRate: 0 }));
    const cases: [string, (count: number) => unknown, number][] = [
      ['materials', (count) => Array.from({ length: count }, () => material), 32],
      ['supplies', (count) => Array.from({ length: count }, () => supply), 50],
      ['channels', channels, 20],
    ];
    for (const [path, build, limit] of cases) {
      const over = await post(withValue(path, build(limit + 1)));
      expect(over.status, `${path} ${limit + 1}`).toBe(400);
      expect(errorOf(over)).toContain(path);
      expect((await post(withValue(path, build(limit)))).status, `${path} ${limit}`).toBe(200);
    }
  });

  it('channel name length', async () => {
    for (const name of ['', 'a'.repeat(61)]) {
      const response = await post(withValue('channels.0.name', name));
      expect(response.status, `length ${name.length}`).toBe(400);
      expect(errorOf(response)).toContain('name');
    }
    expect((await post(withValue('channels.0.name', 'a'.repeat(60)))).status).toBe(200);
  });

  it('undeclared nested property returns 400', async () => {
    for (const path of ['extra', 'printer.extra', 'materials.0.extra']) {
      const response = await post(withValue(path, true));
      expect(response.status, path).toBe(400);
      expect(errorOf(response), path).toContain('should not exist');
    }
  });
});
