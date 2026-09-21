import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { design3007827 } from '../src/modules/print-profiles/fixtures/design-3007827.js';
import { MAKERWORLD_CLIENT } from '../src/modules/print-profiles/makerworld.client.js';
import { PrintProfileError } from '../src/modules/print-profiles/print-profile.error.js';

const SEA_STAR_URL =
  'https://makerworld.com/pt/models/3007827-sea-animals-set?from=recommend#profileId-3387944';
const UNAVAILABLE = 'Não foi possível consultar o MakerWorld agora. Preencha os dados manualmente';

const SEA_STAR_FILAMENTS = [
  { slot: 1, type: 'PLA', color: '#FD8008', grams: 8, meters: 2.66 },
  { slot: 4, type: 'PLA', color: '#000000', grams: 1, meters: 0.08 },
];

// Cliente falso: devolve o que o teste mandar ou lança o erro pedido. Sem rede.
const fakeClient = {
  next: (): Promise<unknown> => Promise.resolve(design3007827()),
  calls: [] as unknown[],
  fetchDesign(designId: number): Promise<unknown> {
    this.calls.push(designId);
    return this.next();
  },
};

describe('POST /print-profiles/import (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MAKERWORLD_CLIENT)
      .useValue(fakeClient)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    fakeClient.calls = [];
    fakeClient.next = () => Promise.resolve(design3007827());
  });

  const post = (body: unknown) =>
    request(app.getHttpServer()).post('/print-profiles/import').send(body as object);

  const errorOf = (response: { body: unknown }): string => (response.body as { error: string }).error;

  it('imports the sea star profile', async () => {
    const response = await post({ url: SEA_STAR_URL });
    expect(response.status).toBe(200);
    const body = response.body as {
      source: unknown;
      model: unknown;
      selectedProfileId: unknown;
      profiles: { id: number }[];
    };
    expect(body.source).toEqual({
      platform: 'makerworld',
      designId: 3007827,
      url: 'https://makerworld.com/models/3007827',
    });
    expect(body.model).toEqual({
      title: 'Sea animals - set',
      coverUrl:
        'https://makerworld.bblmw.com/makerworld/model/USafe737868bbaa/design/6c21105d01a14e2f.jpeg',
      license: 'Standard Digital File License',
      designer: 'Real_Prints',
    });
    expect(body.selectedProfileId).toBe(3387944);
    expect(body.profiles).toHaveLength(3);
    expect(body.profiles.find((profile) => profile.id === 3387944)).toEqual({
      id: 3387944,
      title: 'Sea star',
      printSeconds: 1707,
      totalGrams: 9,
      needsAms: true,
      printer: { name: 'X2D', nozzleDiameterMm: 0.4 },
      settings: { layerHeightMm: 0.2, wallLoops: 2, sparseInfillRate: 0.15 },
      filaments: SEA_STAR_FILAMENTS,
      plates: [{ index: 1, printSeconds: 1707, totalGrams: 9, filaments: SEA_STAR_FILAMENTS }],
    });
  });

  it('client receives only the design id', async () => {
    await post({ url: SEA_STAR_URL });
    expect(fakeClient.calls).toEqual([3007827]);
    expect(typeof fakeClient.calls[0]).toBe('number');
  });

  it('invalid url returns 400', async () => {
    const response = await post({ url: 'https://www.printables.com/model/1' });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'URL inválida: cole o link de um modelo do MakerWorld (https://makerworld.com/models/…)',
    });
    expect(fakeClient.calls).toEqual([]);
  });

  it('body validation', async () => {
    const missing = await post({});
    expect(missing.status).toBe(400);
    expect(errorOf(missing)).toContain('url');

    const notText = await post({ url: 123 });
    expect(notText.status).toBe(400);
    expect(errorOf(notText)).toContain('url');

    const extra = await post({ url: SEA_STAR_URL, extra: 1 });
    expect(extra.status).toBe(400);
    expect(errorOf(extra)).toContain('should not exist');
  });

  it('unknown profile returns 400', async () => {
    const response = await post({ url: 'https://makerworld.com/models/3007827#profileId-999' });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error:
        'Perfil 999 não existe no modelo 3007827. Remova o #profileId da URL para ver os perfis disponíveis',
    });
  });

  it('upstream errors', async () => {
    fakeClient.next = () =>
      Promise.reject(new PrintProfileError(404, 'Modelo 3007827 não encontrado no MakerWorld'));
    const notFound = await post({ url: SEA_STAR_URL });
    expect(notFound.status).toBe(404);
    expect(notFound.body).toEqual({ error: 'Modelo 3007827 não encontrado no MakerWorld' });

    fakeClient.next = () => Promise.reject(new PrintProfileError(502, UNAVAILABLE));
    const unavailable = await post({ url: SEA_STAR_URL });
    expect(unavailable.status).toBe(502);
    expect(unavailable.body).toEqual({ error: UNAVAILABLE });

    const health = await request(app.getHttpServer()).get('/health');
    expect(health.status).toBe(200);
  });

  it('model without profiles returns 200', async () => {
    fakeClient.next = () => Promise.resolve({ ...design3007827(), instances: [] });
    const response = await post({ url: 'https://makerworld.com/models/3007827' });
    expect(response.status).toBe(200);
    const body = response.body as { profiles: unknown; selectedProfileId: unknown };
    expect(body.profiles).toEqual([]);
    expect(body.selectedProfileId).toBeNull();
  });

  it('url longer than 2048 characters returns 400', async () => {
    const url = `https://makerworld.com/models/3007827?${'a'.repeat(2049)}`;
    const response = await post({ url });
    expect(response.status).toBe(400);
    expect(errorOf(response)).toContain('url');
    expect(errorOf(response)).not.toContain('URL inválida');
    expect(fakeClient.calls).toEqual([]);
  });

  it('url with exactly 2048 characters is accepted', async () => {
    const base = 'https://makerworld.com/models/3007827?from=';
    const url = `${base}${'a'.repeat(2048 - base.length)}`;
    expect(url).toHaveLength(2048);
    const response = await post({ url });
    expect(response.status).toBe(200);
    expect(fakeClient.calls).toEqual([3007827]);
  });
});
