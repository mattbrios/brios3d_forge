import type { ClientRequest, RequestOptions } from 'node:http';
import { EventEmitter } from 'node:events';

// O padrão (baseUrl https) precisa passar pelo `get` do `node:https` (door 4, AD-011). Aqui o
// `get` é substituído por um que só registra a chamada e falha com erro de rede: sem internet.
const httpsCalls: { url: URL; options: RequestOptions }[] = [];
const httpCalls: unknown[] = [];

vi.mock('node:https', () => ({
  get: (url: URL, options: RequestOptions) => {
    httpsCalls.push({ url, options });
    const req = new EventEmitter() as ClientRequest;
    queueMicrotask(() => req.emit('error', new Error('offline')));
    return req;
  },
}));

vi.mock('node:http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:http')>();
  return {
    ...actual,
    get: (...args: unknown[]) => {
      httpCalls.push(args);
      throw new Error('node:http não deve ser usado para https');
    },
  };
});

const { HttpMakerWorldClient } = await import('./makerworld.client.js');

describe('HttpMakerWorldClient over https', () => {
  it('uses node:https for the default base url', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await new HttpMakerWorldClient().fetchDesign(3007827).catch(() => undefined);

    expect(httpCalls).toHaveLength(0);
    expect(httpsCalls).toHaveLength(1);
    const [{ url, options }] = httpsCalls;
    expect(url.href).toBe('https://makerworld.com/api/v1/design-service/design/3007827');
    expect(options.headers).toMatchObject({ accept: 'application/json' });
    expect(String((options.headers as Record<string, string>)['user-agent'])).toMatch(
      /^Brios3DForge\//,
    );
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });
});
