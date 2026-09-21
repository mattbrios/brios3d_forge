import { Logger } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { HttpMakerWorldClient } from './makerworld.client.js';
import { PrintProfileError } from './print-profile.error.js';

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

const UNAVAILABLE = 'Não foi possível consultar o MakerWorld agora. Preencha os dados manualmente';
const VERSION = (
  JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')) as {
    version: string;
  }
).version;

// Servidor local: nenhum teste acessa a internet.
async function startServer(handler: Handler): Promise<{
  baseUrl: string;
  requests: IncomingMessage[];
  close: () => Promise<void>;
}> {
  const requests: IncomingMessage[] = [];
  const server: Server = createServer((req, res) => {
    requests.push(req);
    handler(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    requests,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

async function rejectionOf(promise: Promise<unknown>): Promise<PrintProfileError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof PrintProfileError) {
      return error;
    }
    throw error;
  }
  throw new Error('expected PrintProfileError');
}

type Failure = { reason: string; handler: Handler; maxBytes?: number; closeFirst?: boolean };

const FAILURES: Failure[] = [
  { reason: 'timeout', handler: () => undefined },
  {
    reason: 'status 500',
    handler: (_req, res) => {
      res.writeHead(500).end('boom');
    },
  },
  {
    reason: 'status 403',
    handler: (_req, res) => {
      res.writeHead(403, { 'content-type': 'text/html' }).end('<title>Just a moment...</title>');
    },
  },
  {
    reason: 'redirect',
    handler: (req, res) => {
      res.writeHead(301, { location: `/moved${req.url ?? ''}` }).end();
    },
  },
  {
    reason: 'too large',
    maxBytes: 1000,
    handler: (_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.write(`{"id":1,"pad":"${'x'.repeat(600)}`);
      res.end(`${'x'.repeat(600)}"}`);
    },
  },
  {
    reason: 'invalid json',
    handler: (_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' }).end('<html>not json</html>');
    },
  },
  { reason: 'network', handler: () => undefined, closeFirst: true },
];

describe('HttpMakerWorldClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requests the design endpoint', async () => {
    const server = await startServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' }).end('{"id":3007827,"title":"x"}');
    });
    try {
      const client = new HttpMakerWorldClient({ baseUrl: server.baseUrl });
      await expect(client.fetchDesign(3007827)).resolves.toEqual({ id: 3007827, title: 'x' });
      expect(server.requests).toHaveLength(1);
      const [req] = server.requests;
      expect(req.method).toBe('GET');
      expect(req.url).toBe('/api/v1/design-service/design/3007827');
      expect(req.headers.accept).toBe('application/json');
      expect(req.headers['user-agent']).toBe(`Brios3DForge/${VERSION}`);
    } finally {
      await server.close();
    }
  });

  it('default limits', () => {
    expect(new HttpMakerWorldClient().options).toEqual({
      baseUrl: 'https://makerworld.com',
      timeoutMs: 10000,
      maxBytes: 5242880,
    });
  });

  it('upstream 404', async () => {
    const server = await startServer((_req, res) => {
      res.writeHead(404, { 'content-type': 'application/json' }).end('{"code":404}');
    });
    try {
      const error = await rejectionOf(
        new HttpMakerWorldClient({ baseUrl: server.baseUrl }).fetchDesign(3007827),
      );
      expect(error.status).toBe(404);
      expect(error.message).toBe('Modelo 3007827 não encontrado no MakerWorld');
    } finally {
      await server.close();
    }
  });

  it('upstream failures are 502', async () => {
    expect(FAILURES).toHaveLength(7);
    for (const failure of FAILURES) {
      const server = await startServer(failure.handler);
      const client = new HttpMakerWorldClient({
        baseUrl: server.baseUrl,
        timeoutMs: 200,
        maxBytes: failure.maxBytes,
      });
      if (failure.closeFirst) {
        await server.close();
      }
      try {
        const error = await rejectionOf(client.fetchDesign(3007827));
        expect(error.status, failure.reason).toBe(502);
        expect(error.message, failure.reason).toBe(UNAVAILABLE);
        if (failure.reason === 'redirect') {
          expect(server.requests).toHaveLength(1);
        }
      } finally {
        if (!failure.closeFirst) {
          await server.close();
        }
      }
    }
  });

  it('logs upstream failure', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    for (const failure of FAILURES) {
      warn.mockClear();
      const server = await startServer(failure.handler);
      const client = new HttpMakerWorldClient({
        baseUrl: server.baseUrl,
        timeoutMs: 200,
        maxBytes: failure.maxBytes,
      });
      if (failure.closeFirst) {
        await server.close();
      }
      try {
        const error = await rejectionOf(client.fetchDesign(3007827));
        expect(warn, failure.reason).toHaveBeenCalledTimes(1);
        const logged = String(warn.mock.calls[0][0]);
        expect(logged, failure.reason).toContain('3007827');
        expect(logged, failure.reason).toContain(failure.reason);
        for (const other of FAILURES) {
          expect(error.message).not.toContain(other.reason);
        }
      } finally {
        if (!failure.closeFirst) {
          await server.close();
        }
      }
    }
  });

  it('timeout aborts the request', async () => {
    const server = await startServer((_req, res) => {
      setTimeout(() => res.writeHead(200).end('{"id":1}'), 5000).unref();
    });
    try {
      const client = new HttpMakerWorldClient({ baseUrl: server.baseUrl, timeoutMs: 200 });
      const started = Date.now();
      const error = await rejectionOf(client.fetchDesign(3007827));
      expect(error.status).toBe(502);
      expect(Date.now() - started).toBeLessThan(2000);
    } finally {
      await server.close();
    }
  });
});
