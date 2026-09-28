import { Logger } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { HttpPrintablesClient } from './printables.client.js';
import { ModelMetadataError } from './model-metadata.error.js';

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

const UNAVAILABLE = 'Não foi possível consultar o Printables agora. Preencha os dados manualmente';
const VERSION = (
  JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')) as {
    version: string;
  }
).version;

// Servidor local: nenhum teste acessa a internet.
async function startServer(handler: Handler): Promise<{
  baseUrl: string;
  requests: { req: IncomingMessage; body: string }[];
  close: () => Promise<void>;
}> {
  const requests: { req: IncomingMessage; body: string }[] = [];
  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      requests.push({ req, body: Buffer.concat(chunks).toString('utf8') });
      handler(req, res);
    });
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

async function rejectionOf(promise: Promise<unknown>): Promise<ModelMetadataError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ModelMetadataError) {
      return error;
    }
    throw error;
  }
  throw new Error('expected ModelMetadataError');
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
      res.write(`{"data":{"print":{"id":"1","pad":"${'x'.repeat(600)}`);
      res.end(`${'x'.repeat(600)}"}}}`);
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

describe('HttpPrintablesClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not follow redirects', async () => {
    const server = await startServer((_req, res) => {
      res.writeHead(301, { location: '/moved' }).end();
    });
    try {
      const client = new HttpPrintablesClient({ baseUrl: server.baseUrl, timeoutMs: 200 });
      const error = await rejectionOf(client.fetchModel('123456'));
      expect(error.status).toBe(502);
      expect(server.requests).toHaveLength(1);
    } finally {
      await server.close();
    }
  });

  it('aborts after timeout', async () => {
    const server = await startServer((_req, res) => {
      setTimeout(() => res.writeHead(200).end('{"data":{"print":{"id":"1"}}}'), 5000).unref();
    });
    try {
      const client = new HttpPrintablesClient({ baseUrl: server.baseUrl, timeoutMs: 200 });
      const started = Date.now();
      const error = await rejectionOf(client.fetchModel('123456'));
      expect(error.status).toBe(502);
      expect(Date.now() - started).toBeLessThan(2000);
    } finally {
      await server.close();
    }
  });

  it('rejects a body over the byte limit', async () => {
    const server = await startServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.write(`{"data":{"print":{"id":"1","pad":"${'x'.repeat(600)}`);
      res.end(`${'x'.repeat(600)}"}}}`);
    });
    try {
      const client = new HttpPrintablesClient({ baseUrl: server.baseUrl, maxBytes: 1000 });
      const error = await rejectionOf(client.fetchModel('123456'));
      expect(error.status).toBe(502);
    } finally {
      await server.close();
    }
  });

  it('sends the honest user-agent', async () => {
    const server = await startServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' }).end('{"data":{"print":{"id":"123456","name":"x"}}}');
    });
    try {
      const client = new HttpPrintablesClient({ baseUrl: server.baseUrl });
      await client.fetchModel('123456');
      expect(server.requests).toHaveLength(1);
      const [{ req, body }] = server.requests;
      expect(req.method).toBe('POST');
      expect(req.url).toBe('/graphql/');
      expect(req.headers['user-agent']).toBe(`Brios3DForge/${VERSION}`);
      expect(JSON.parse(body)).toMatchObject({ variables: { id: '123456' } });
    } finally {
      await server.close();
    }
  });

  it('default limits', () => {
    expect(new HttpPrintablesClient().options).toEqual({
      baseUrl: 'https://api.printables.com',
      timeoutMs: 10000,
      maxBytes: 5242880,
    });
  });

  it('model not found (print: null) is 404', async () => {
    const server = await startServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' }).end('{"data":{"print":null}}');
    });
    try {
      const error = await rejectionOf(new HttpPrintablesClient({ baseUrl: server.baseUrl }).fetchModel('999'));
      expect(error.status).toBe(404);
      expect(error.message).toBe('Modelo 999 não encontrado no Printables');
    } finally {
      await server.close();
    }
  });

  it('upstream failures are 502', async () => {
    expect(FAILURES).toHaveLength(7);
    for (const failure of FAILURES) {
      const server = await startServer(failure.handler);
      const client = new HttpPrintablesClient({
        baseUrl: server.baseUrl,
        timeoutMs: 200,
        maxBytes: failure.maxBytes,
      });
      if (failure.closeFirst) {
        await server.close();
      }
      try {
        const error = await rejectionOf(client.fetchModel('123456'));
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

  it('logs upstream failure without leaking the reason in the message', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    for (const failure of FAILURES) {
      warn.mockClear();
      const server = await startServer(failure.handler);
      const client = new HttpPrintablesClient({
        baseUrl: server.baseUrl,
        timeoutMs: 200,
        maxBytes: failure.maxBytes,
      });
      if (failure.closeFirst) {
        await server.close();
      }
      try {
        const error = await rejectionOf(client.fetchModel('123456'));
        expect(warn, failure.reason).toHaveBeenCalledTimes(1);
        const logged = String(warn.mock.calls[0][0]);
        expect(logged, failure.reason).toContain('123456');
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
});
