import { Body, Controller, Get, INestApplication, Logger, Post, Query } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { Public } from '../src/modules/auth/public.decorator.js';

class ProbeBody {
  @IsString()
  name: string;

  @IsInt()
  @Min(1)
  qty: number;
}

class ProbeQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  count?: number;
}

// Público: este arquivo prova o contrato de erro, não a autenticação.
@Public()
@Controller('probe')
class ProbeController {
  @Post()
  create(@Body() body: ProbeBody) {
    return { received: body };
  }

  @Get('count')
  count(@Query() query: ProbeQuery) {
    return {
      value: query.count,
      type: typeof query.count,
      isInstance: query instanceof ProbeQuery,
    };
  }

  @Get('boom')
  boom(): never {
    throw new Error('segredo');
  }
}

describe('Error contract (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProbeController],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('every error status returns only the error key', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const server = app.getHttpServer();
    const responses = [
      await request(server).get('/nada'),
      await request(server)
        .post('/probe')
        .set('Content-Type', 'application/json')
        .send('{x'),
      await request(server).post('/probe').send({ name: 1 }),
      await request(server).get('/probe/boom'),
    ];
    expect(responses.map((response) => response.status)).toEqual([404, 400, 400, 500]);
    for (const response of responses) {
      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(Object.keys(response.body as object)).toEqual(['error']);
      const { error } = response.body as { error: unknown };
      expect(typeof error).toBe('string');
      expect((error as string).length).toBeGreaterThan(0);
    }
  });

  it('unknown route returns 404', async () => {
    const response = await request(app.getHttpServer()).get('/nada');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Cannot GET /nada' });
  });

  it('malformed JSON returns 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/probe')
      .set('Content-Type', 'application/json')
      .send('{x');
    expect(response.status).toBe(400);
    expect(Object.keys(response.body as object)).toEqual(['error']);
  });

  it('validation errors are joined', async () => {
    const response = await request(app.getHttpServer()).post('/probe').send({ name: 1 });
    expect(response.status).toBe(400);
    const messages = (response.body as { error: string }).error.split('; ');
    expect(messages).toContain('name must be a string');
    expect(messages).toContain('qty must be an integer number');
    expect(messages).toContain('qty must not be less than 1');
  });

  it('undeclared property returns 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/probe')
      .send({ name: 'ok', qty: 1, extra: true });
    expect(response.status).toBe(400);
    expect((response.body as { error: string }).error).toContain(
      'property extra should not exist',
    );
  });

  it('numeric string is transformed', async () => {
    const response = await request(app.getHttpServer()).get('/probe/count?count=5');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ value: 5, type: 'number', isInstance: true });
  });

  it('unexpected error returns 500', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const response = await request(app.getHttpServer()).get('/probe/boom');
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Internal server error' });
    expect(response.text).not.toContain('segredo');
    expect(response.text).not.toContain('at ');
  });
});
