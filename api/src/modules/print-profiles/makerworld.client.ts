import { Logger } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { PrintProfileError, UNAVAILABLE_MESSAGE } from './print-profile.error.js';

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
  JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')) as {
    version: string;
  }
).version;

class UpstreamFailure extends Error {}

// Padrão de chamada HTTP de saída (AD-009): host fixo, só o id numérico entra na URL, sem
// seguir redirecionamento, com timeout e limite de tamanho do corpo.
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
    try {
      return await this.request(designId);
    } catch (error) {
      if (error instanceof PrintProfileError) {
        throw error;
      }
      this.logger.warn(`MakerWorld design ${designId}: ${reasonOf(error)}`);
      throw new PrintProfileError(502, UNAVAILABLE_MESSAGE);
    }
  }

  private async request(designId: number): Promise<unknown> {
    const response = await fetch(
      `${this.options.baseUrl}/api/v1/design-service/design/${designId}`,
      {
        redirect: 'error',
        signal: AbortSignal.timeout(this.options.timeoutMs),
        headers: { accept: 'application/json', 'user-agent': `Brios3DForge/${VERSION}` },
      },
    );
    if (response.status === 404) {
      await response.body?.cancel();
      throw new PrintProfileError(404, `Modelo ${designId} não encontrado no MakerWorld`);
    }
    if (response.status !== 200) {
      await response.body?.cancel();
      throw new UpstreamFailure(`status ${response.status}`);
    }
    const text = await this.readLimited(response);
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new UpstreamFailure('invalid json');
    }
  }

  private async readLimited(response: Response): Promise<string> {
    const declared = Number(response.headers.get('content-length'));
    if (declared > this.options.maxBytes) {
      await response.body?.cancel();
      throw new UpstreamFailure('too large');
    }
    if (!response.body) {
      return '';
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      total += value.byteLength;
      if (total > this.options.maxBytes) {
        await reader.cancel();
        throw new UpstreamFailure('too large');
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString('utf8');
  }
}

function reasonOf(error: unknown): string {
  if (error instanceof UpstreamFailure) {
    return error.message;
  }
  if (error instanceof Error && error.name === 'TimeoutError') {
    return 'timeout';
  }
  const cause = error instanceof Error ? error.cause : undefined;
  if (cause instanceof Error && /redirect/i.test(cause.message)) {
    return 'redirect';
  }
  return 'network';
}
