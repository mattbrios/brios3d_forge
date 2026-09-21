import { Logger } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { get as httpGet } from 'node:http';
import { get as httpsGet } from 'node:https';
import {
  PrintProfileError,
  UNAVAILABLE_MESSAGE,
} from './print-profile.error.js';

// Fonte dos dados (door 2): a API JSON não documentada do MakerWorld. A página HTML responde
// 403 (Cloudflare) para o servidor. A interface isola a troca de fonte se a API mudar.
export interface MakerWorldClient {
  fetchDesign(designId: number): Promise<unknown>;
}

export const MAKERWORLD_CLIENT = Symbol('MAKERWORLD_CLIENT');

export interface MakerWorldClientOptions {
  baseUrl: string;
  timeoutMs: number;
  maxBytes: number;
}

const DEFAULT_OPTIONS: MakerWorldClientOptions = {
  baseUrl: 'https://makerworld.com',
  timeoutMs: 10_000,
  maxBytes: 5 * 1024 * 1024,
};

// O caminho relativo é o mesmo em src/ (testes) e em dist/ (build).
const VERSION = (
  JSON.parse(
    readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'),
  ) as {
    version: string;
  }
).version;

class UpstreamFailure extends Error {}

// Padrão de chamada HTTP de saída (AD-011): host fixo, só o id numérico entra na URL, sem
// seguir redirecionamento, com timeout e limite de tamanho do corpo. Usa `node:https` porque o
// Cloudflare do MakerWorld desafia o `fetch` nativo do Node (403) mesmo com este User-Agent.
export class HttpMakerWorldClient implements MakerWorldClient {
  readonly options: MakerWorldClientOptions;
  private readonly logger = new Logger('MakerWorldClient');

  constructor(options: Partial<MakerWorldClientOptions> = {}) {
    this.options = {
      baseUrl: options.baseUrl ?? DEFAULT_OPTIONS.baseUrl,
      timeoutMs: options.timeoutMs ?? DEFAULT_OPTIONS.timeoutMs,
      maxBytes: options.maxBytes ?? DEFAULT_OPTIONS.maxBytes,
    };
  }

  async fetchDesign(designId: number): Promise<unknown> {
    const signal = AbortSignal.timeout(this.options.timeoutMs);
    try {
      const body = await this.request(designId, signal);
      try {
        return JSON.parse(body) as unknown;
      } catch {
        throw new UpstreamFailure('invalid json');
      }
    } catch (error) {
      if (error instanceof PrintProfileError) {
        throw error;
      }
      const reason =
        error instanceof UpstreamFailure
          ? error.message
          : signal.aborted
            ? 'timeout'
            : 'network';
      this.logger.warn(`MakerWorld design ${designId}: ${reason}`);
      throw new PrintProfileError(502, UNAVAILABLE_MESSAGE);
    }
  }

  private request(designId: number, signal: AbortSignal): Promise<string> {
    const url = new URL(
      `/api/v1/design-service/design/${designId}`,
      this.options.baseUrl,
    );
    // http só para o servidor local dos testes; o baseUrl padrão é https.
    const get = url.protocol === 'http:' ? httpGet : httpsGet;
    const { maxBytes } = this.options;

    return new Promise<string>((resolve, reject) => {
      const req = get(
        url,
        {
          signal,
          headers: {
            accept: 'application/json',
            'user-agent': `Brios3DForge/${VERSION}`,
          },
        },
        (res) => {
          const status = res.statusCode ?? 0;
          if (status === 404) {
            res.resume();
            reject(
              new PrintProfileError(
                404,
                `Modelo ${designId} não encontrado no MakerWorld`,
              ),
            );
            return;
          }
          if (status !== 200) {
            res.resume();
            reject(
              new UpstreamFailure(
                status >= 300 && status < 400 ? 'redirect' : `status ${status}`,
              ),
            );
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
    });
  }
}
