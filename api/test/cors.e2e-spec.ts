import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

describe('CORS (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    vi.stubEnv('FRONTEND_URL', 'http://localhost:3000');
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  const preflight = (origin: string) =>
    request(app.getHttpServer())
      .options('/auth/me')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'GET');

  it('allows credentials only for the frontend origin', async () => {
    const allowed = await preflight('http://localhost:3000');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');

    const other = await preflight('http://evil.test');
    expect(other.headers['access-control-allow-origin']).not.toBe('http://evil.test');
  });
});
