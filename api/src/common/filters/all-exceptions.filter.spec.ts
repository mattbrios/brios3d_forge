import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

function createHost() {
  const response = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ method: 'GET', url: '/x' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('body has only the error key', () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const cases: unknown[] = [
      new NotFoundException('Cannot GET /nada'),
      new BadRequestException(['a must be a string', 'b must be an integer number']),
      new HttpException('Conflict here', 409),
      new Error('segredo'),
      'thrown string',
    ];
    for (const exception of cases) {
      const { host, response } = createHost();
      filter.catch(exception, host);
      expect(Object.keys(response.body as object)).toEqual(['error']);
      const { error } = response.body as { error: unknown };
      expect(typeof error).toBe('string');
      expect((error as string).length).toBeGreaterThan(0);
    }
  });

  it('keeps the status and string message of an HttpException', () => {
    const { host, response } = createHost();
    filter.catch(new NotFoundException('Cannot GET /nada'), host);
    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({ error: 'Cannot GET /nada' });
  });

  it('array message is joined', () => {
    const { host, response } = createHost();
    filter.catch(
      new BadRequestException(['name must be a string', 'qty must be an integer number']),
      host,
    );
    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: 'name must be a string; qty must be an integer number',
    });
  });

  it('non-http exception returns generic 500', () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    for (const exception of [new Error('segredo'), 'segredo']) {
      const { host, response } = createHost();
      filter.catch(exception, host);
      expect(response.statusCode).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
      expect(JSON.stringify(response.body)).not.toContain('segredo');
    }
  });

  it('logs the stack', () => {
    const logSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const error = new Error('segredo');
    const { host } = createHost();
    filter.catch(error, host);
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0]).toContain(error.stack);
  });
});
