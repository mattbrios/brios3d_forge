import { Logger } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { ModelMetadataError, unavailableMessage } from './model-metadata.error.js';

// Fonte dos dados (Landing): a API GraphQL não documentada do Printables
// (`https://api.printables.com/graphql/`), verificada ao vivo em 2026-09-28. A interface isola a
// troca de fonte se a API mudar.
export interface PrintablesClient {
  fetchModel(externalId: string): Promise<unknown>;
}

export const PRINTABLES_CLIENT = Symbol('PRINTABLES_CLIENT');

export interface PrintablesClientOptions {
  baseUrl: string;
  timeoutMs: number;
  maxBytes: number;
}

const DEFAULT_OPTIONS: PrintablesClientOptions = {
  baseUrl: 'https://api.printables.com',
  timeoutMs: 10_000,
  maxBytes: 5 * 1024 * 1024,
};

// O caminho relativo é o mesmo em src/ (testes) e em dist/ (build).
const VERSION = (
  JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')) as {
    version: string;
  }
).version;

const QUERY =
  'query($id:ID!){ print(id:$id){ id name license { id name } user { publicUsername } image { filePath } } }';

class UpstreamFailure extends Error {}

const PLATFORM_LABEL = 'Printables';

// Padrão de chamada HTTP de saída (AD-011): host fixo, só o id numérico entra no corpo da
// requisição, sem seguir redirecionamento, com timeout e limite de tamanho do corpo. `node:https`
// no POST em vez de GET, mesmo desenho do `HttpMakerWorldClient`.
export class HttpPrintablesClient implements PrintablesClient {
  readonly options: PrintablesClientOptions;
  private readonly logger = new Logger('PrintablesClient');

  constructor(options: Partial<PrintablesClientOptions> = {}) {
    this.options = {
      baseUrl: options.baseUrl ?? DEFAULT_OPTIONS.baseUrl,
      timeoutMs: options.timeoutMs ?? DEFAULT_OPTIONS.timeoutMs,
      maxBytes: options.maxBytes ?? DEFAULT_OPTIONS.maxBytes,
    };
  }

  async fetchModel(externalId: string): Promise<unknown> {
    const signal = AbortSignal.timeout(this.options.timeoutMs);
    try {
      const body = await this.request(externalId, signal);
      let parsed: unknown;
      try {
        parsed = JSON.parse(body) as unknown;
      } catch {
        throw new UpstreamFailure('invalid json');
      }
      const print = (parsed as { data?: { print?: unknown } } | null)?.data?.print;
      if (print === null || print === undefined) {
        throw new ModelMetadataError(404, `Modelo ${externalId} não encontrado no Printables`);
      }
      return print;
    } catch (error) {
      if (error instanceof ModelMetadataError) {
        throw error;
      }
      const reason =
        error instanceof UpstreamFailure ? error.message : signal.aborted ? 'timeout' : 'network';
      this.logger.warn(`Printables model ${externalId}: ${reason}`);
      throw new ModelMetadataError(502, unavailableMessage(PLATFORM_LABEL));
    }
  }

  private request(externalId: string, signal: AbortSignal): Promise<string> {
    const url = new URL('/graphql/', this.options.baseUrl);
    // http só para o servidor local dos testes; o baseUrl padrão é https.
    const send = url.protocol === 'http:' ? httpRequest : httpsRequest;
    const { maxBytes } = this.options;
    const payload = JSON.stringify({ query: QUERY, variables: { id: externalId } });

    return new Promise<string>((resolve, reject) => {
      const req = send(
        url,
        {
          method: 'POST',
          signal,
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(payload),
            'user-agent': `Brios3DForge/${VERSION}`,
          },
        },
        (res) => {
          const status = res.statusCode ?? 0;
          if (status !== 200) {
            res.resume();
            reject(new UpstreamFailure(status >= 300 && status < 400 ? 'redirect' : `status ${status}`));
            return;
          }
          if (Number(res.headers['content-length']) > maxBytes) {
            res.destroy();
            reject(new UpstreamFailure('too large'));
            return;
          }
          const chunks: Buffer[] = [];
          let total = 0;
          res.on('data', (chunk: Buffer) => {
            total += chunk.byteLength;
            if (total > maxBytes) {
              res.destroy();
              reject(new UpstreamFailure('too large'));
              return;
            }
            chunks.push(chunk);
          });
          res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
          res.on('error', reject);
        },
      );
      req.on('error', reject);
      req.end(payload);
    });
  }
}
