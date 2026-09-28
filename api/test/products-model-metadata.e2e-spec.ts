import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { design3007827 } from '../src/modules/print-profiles/fixtures/design-3007827.js';
import { MAKERWORLD_CLIENT } from '../src/modules/print-profiles/makerworld.client.js';
import { PrintProfileError } from '../src/modules/print-profiles/print-profile.error.js';
import { PRINTABLES_CLIENT } from '../src/modules/products/printables.client.js';
import { ModelMetadataError } from '../src/modules/products/model-metadata.error.js';
import { createUser, deleteUsers, loginCookie } from './auth-helper.js';
import { createProduct, deleteProducts } from './products-helper.js';

const MAKERWORLD_URL = 'https://makerworld.com/models/3007827';
const PRINTABLES_URL = 'https://www.printables.com/model/123456-vaso-espiral';
const THINGIVERSE_URL = 'https://www.thingiverse.com/thing:4567890';
const THINGIVERSE_MESSAGE =
  'Busca automática não disponível para o Thingiverse. Preencha os dados manualmente';
const INVALID_URL = 'URL do modelo inválida: use um link de modelo do Printables, do MakerWorld ou do Thingiverse';
const PRINTABLES_UNAVAILABLE = 'Não foi possível consultar o Printables agora. Preencha os dados manualmente';
const MAKERWORLD_UNAVAILABLE = 'Não foi possível consultar o MakerWorld agora. Preencha os dados manualmente';
const PRODUCT_NOT_FOUND = 'Produto não encontrado';

function printablesPrint(overrides: Record<string, unknown> = {}) {
  return {
    id: '123456',
    name: 'Vaso espiral',
    license: { id: 'cc-by', name: 'Creative Commons — Attribution' },
    user: { publicUsername: 'designer_x' },
    image: { filePath: 'model/abc/design/def.jpeg' },
    ...overrides,
  };
}

// Clientes falsos: devolvem o que o teste mandar ou lançam o erro pedido. Sem rede.
function fakeClient() {
  return {
    next: (): Promise<unknown> => Promise.resolve(null),
    calls: [] as unknown[],
    fetchModel(externalId: string): Promise<unknown> {
      this.calls.push(externalId);
      return this.next();
    },
    fetchDesign(designId: number): Promise<unknown> {
      this.calls.push(designId);
      return this.next();
    },
  };
}

describe('POST /products/model-metadata and .../refresh (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let cookie: string;
  let printables: ReturnType<typeof fakeClient>;
  let makerworld: ReturnType<typeof fakeClient>;

  beforeAll(async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    printables = fakeClient();
    makerworld = fakeClient();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PRINTABLES_CLIENT)
      .useValue(printables)
      .overrideProvider(MAKERWORLD_CLIENT)
      .useValue(makerworld)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    dataSource = app.get(DataSource);
    await deleteProducts(dataSource);
    await deleteUsers(dataSource, ['model-metadata-e2e@test.local']);
    await createUser(dataSource, { email: 'model-metadata-e2e@test.local', role: 'admin' });
    cookie = await loginCookie(app.getHttpServer(), 'model-metadata-e2e@test.local');
  });

  afterAll(async () => {
    await deleteProducts(dataSource);
    await deleteUsers(dataSource, ['model-metadata-e2e@test.local']);
    await app.close();
  });

  beforeEach(() => {
    printables.calls = [];
    printables.next = () => Promise.resolve(printablesPrint());
    makerworld.calls = [];
    makerworld.next = () => Promise.resolve(design3007827());
  });

  const preview = (body: unknown) =>
    request(app.getHttpServer()).post('/products/model-metadata').set('Cookie', cookie).send(body as object);
  const refresh = (productId: string) =>
    request(app.getHttpServer()).post(`/products/${productId}/model-metadata/refresh`).set('Cookie', cookie);
  const errorOf = (response: { body: unknown }): string => (response.body as { error: string }).error;
  const productCount = async (): Promise<number> => {
    const rows: Array<{ n: string }> = await dataSource.query('SELECT count(*) AS n FROM products');
    return Number(rows[0].n);
  };

  // ---------- S1: preview ----------

  it('C1: printables preview', async () => {
    const before = await productCount();
    const response = await preview({ modelUrl: PRINTABLES_URL });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      title: 'Vaso espiral',
      imageUrl: 'https://media.printables.com/model/abc/design/def.jpeg',
      designer: 'designer_x',
      license: 'Creative Commons — Attribution',
      commercialUseAllowed: true,
    });
    expect(printables.calls).toEqual(['123456']);
    expect(await productCount()).toBe(before);
  });

  it('C2: makerworld preview', async () => {
    const before = await productCount();
    const response = await preview({ modelUrl: MAKERWORLD_URL });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      title: 'Sea animals - set',
      imageUrl: 'https://makerworld.bblmw.com/makerworld/model/USafe737868bbaa/design/6c21105d01a14e2f.jpeg',
      designer: 'Real_Prints',
      license: 'Standard Digital File License',
      commercialUseAllowed: false,
    });
    expect(makerworld.calls).toEqual([3007827]);
    expect(await productCount()).toBe(before);
  });

  it('C3: unsupported domain returns 400', async () => {
    const response = await preview({ modelUrl: 'https://example.com/model/1' });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: INVALID_URL });
    expect(printables.calls).toEqual([]);
    expect(makerworld.calls).toEqual([]);
  });

  it('C4: thingiverse url returns 400', async () => {
    const response = await preview({ modelUrl: THINGIVERSE_URL });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: THINGIVERSE_MESSAGE });
    expect(printables.calls).toEqual([]);
    expect(makerworld.calls).toEqual([]);
  });

  it('C5: model not found returns 404 for a printables model', async () => {
    printables.next = () => Promise.reject(new ModelMetadataError(404, 'Modelo 123456 não encontrado no Printables'));
    const response = await preview({ modelUrl: PRINTABLES_URL });
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Modelo 123456 não encontrado no Printables' });
  });

  it('C6: upstream failure returns 502 without leaking the detail', async () => {
    // O client real (HttpPrintablesClient/HttpMakerWorldClient) já converte qualquer falha de
    // rede/parse num erro de domínio antes de sair do client - o fake reproduz esse contrato.
    printables.next = () => Promise.reject(new ModelMetadataError(502, PRINTABLES_UNAVAILABLE));
    const printablesFailure = await preview({ modelUrl: PRINTABLES_URL });
    expect(printablesFailure.status).toBe(502);
    expect(printablesFailure.body).toEqual({ error: PRINTABLES_UNAVAILABLE });
    expect(errorOf(printablesFailure)).not.toContain('ECONNRESET');

    makerworld.next = () => Promise.reject(new PrintProfileError(502, MAKERWORLD_UNAVAILABLE));
    const makerworldFailure = await preview({ modelUrl: MAKERWORLD_URL });
    expect(makerworldFailure.status).toBe(502);
    expect(makerworldFailure.body).toEqual({ error: MAKERWORLD_UNAVAILABLE });
  });

  it('C7: does not write to products table in any case', async () => {
    const before = await productCount();
    await preview({ modelUrl: PRINTABLES_URL });
    await preview({ modelUrl: MAKERWORLD_URL });
    await preview({ modelUrl: 'https://example.com/model/1' });
    await preview({ modelUrl: THINGIVERSE_URL });
    printables.next = () => Promise.reject(new ModelMetadataError(404, 'x'));
    await preview({ modelUrl: PRINTABLES_URL });
    printables.next = () => Promise.reject(new ModelMetadataError(502, 'y'));
    await preview({ modelUrl: PRINTABLES_URL });
    expect(await productCount()).toBe(before);
  });

  // ---------- S3: refresh ----------

  it('C13: refresh overwrites metadata fields', async () => {
    const productId = await createProduct(dataSource, {
      modelPlatform: 'printables',
      modelExternalId: '123456-c13',
      modelUrl: PRINTABLES_URL,
      modelTitle: 'Título antigo',
      commercialUseAllowed: null,
    });
    const before = await dataSource.query('SELECT model_metadata_fetched_at FROM products WHERE id = $1', [productId]);
    expect(before[0].model_metadata_fetched_at).toBeNull();

    const response = await refresh(productId);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      modelTitle: 'Vaso espiral',
      modelImageUrl: 'https://media.printables.com/model/abc/design/def.jpeg',
      modelDesigner: 'designer_x',
      modelLicense: 'Creative Commons — Attribution',
      commercialUseAllowed: true,
    });
    expect(response.body.modelMetadataFetchedAt).not.toBeNull();
  });

  it('C14: refresh unknown product returns 404', async () => {
    const response = await refresh('00000000-0000-0000-0000-000000000000');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: PRODUCT_NOT_FOUND });
  });

  it('C15: refresh thingiverse product returns 400', async () => {
    const productId = await createProduct(dataSource, {
      modelPlatform: 'thingiverse',
      modelExternalId: '4567890-c15',
      modelUrl: THINGIVERSE_URL,
      modelTitle: 'Original',
    });
    const response = await refresh(productId);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: THINGIVERSE_MESSAGE });
    const row = await dataSource.query('SELECT model_title FROM products WHERE id = $1', [productId]);
    expect(row[0].model_title).toBe('Original');
  });

  it('C16: refresh upstream failure leaves product unchanged', async () => {
    const productId = await createProduct(dataSource, {
      modelPlatform: 'printables',
      modelExternalId: '123456-c16',
      modelUrl: PRINTABLES_URL,
      modelTitle: 'Original',
    });
    printables.next = () => Promise.reject(new ModelMetadataError(404, 'Modelo 123456 não encontrado no Printables'));
    const notFound = await refresh(productId);
    expect(notFound.status).toBe(404);
    const afterNotFound = await dataSource.query('SELECT model_title FROM products WHERE id = $1', [productId]);
    expect(afterNotFound[0].model_title).toBe('Original');

    printables.next = () => Promise.reject(new ModelMetadataError(502, PRINTABLES_UNAVAILABLE));
    const unavailable = await refresh(productId);
    expect(unavailable.status).toBe(502);
    expect(unavailable.body).toEqual({ error: PRINTABLES_UNAVAILABLE });
    const afterUnavailable = await dataSource.query('SELECT model_title FROM products WHERE id = $1', [productId]);
    expect(afterUnavailable[0].model_title).toBe('Original');
  });

  it('C17: refresh forbidden for non-admin', async () => {
    await deleteUsers(dataSource, ['model-metadata-production@test.local']);
    await createUser(dataSource, { email: 'model-metadata-production@test.local', role: 'production' });
    const productionCookie = await loginCookie(app.getHttpServer(), 'model-metadata-production@test.local');
    const productId = await createProduct(dataSource, { modelPlatform: 'printables', modelExternalId: '123456-c17' });

    const previewResponse = await request(app.getHttpServer())
      .post('/products/model-metadata')
      .set('Cookie', productionCookie)
      .send({ modelUrl: PRINTABLES_URL });
    expect(previewResponse.status).toBe(403);

    const refreshResponse = await request(app.getHttpServer())
      .post(`/products/${productId}/model-metadata/refresh`)
      .set('Cookie', productionCookie);
    expect(refreshResponse.status).toBe(403);

    await deleteUsers(dataSource, ['model-metadata-production@test.local']);
  });

  it('C18: refresh is repeatable, overwriting the same fields each time', async () => {
    const productId = await createProduct(dataSource, {
      modelPlatform: 'printables',
      modelExternalId: '123456-c18',
      modelUrl: PRINTABLES_URL,
    });
    const first = await refresh(productId);
    expect(first.status).toBe(200);
    const firstFetchedAt = first.body.modelMetadataFetchedAt as string;

    printables.next = () => Promise.resolve(printablesPrint({ name: 'Vaso espiral v2' }));
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await refresh(productId);
    expect(second.status).toBe(200);
    expect(second.body.modelTitle).toBe('Vaso espiral v2');
    expect(new Date(second.body.modelMetadataFetchedAt as string).getTime()).toBeGreaterThan(
      new Date(firstFetchedAt).getTime(),
    );
  });
});
