import { BadRequestException } from '@nestjs/common';
import { parseMakerWorldUrl } from '../print-profiles/makerworld-url.js';
import type { ModelPlatform } from './entities/product.entity.js';
import { INVALID_MODEL_URL } from './products.types.js';

export interface ModelIdentity {
  platform: ModelPlatform;
  externalId: string;
}

const PRINTABLES_HOSTS = new Set(['printables.com', 'www.printables.com']);
const THINGIVERSE_HOSTS = new Set(['thingiverse.com', 'www.thingiverse.com']);
const MAKERWORLD_HOSTS = new Set(['makerworld.com', 'www.makerworld.com']);

// Prefixo de idioma opcional de 2 letras, `/model/<id>`, slug e subcaminho opcionais (Assumption
// do plano: formato observado, sem documentação oficial).
const PRINTABLES_PATH = /^\/(?:[a-z]{2}\/)?model\/(\d+)(?:-[^/]*)?(?:\/.*)?$/i;
// `/thing:<id>` com subcaminho opcional (`/files`, `/comments`).
const THINGIVERSE_PATH = /^\/thing:(\d+)(?:\/.*)?$/i;

// Door 3: detecta a plataforma e extrai o id do modelo. Tudo o que não for um link de modelo
// das três plataformas vira o mesmo 400 (AC 5).
export function parseModelUrl(input: string): ModelIdentity {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw invalid();
  }
  if (url.protocol !== 'https:' || url.port !== '' || url.username !== '' || url.password !== '') {
    throw invalid();
  }
  if (MAKERWORLD_HOSTS.has(url.hostname)) {
    // Reusa o parser da Fase 2, que já aceita `/pt/`, slug, query e `#profileId-`.
    try {
      return { platform: 'makerworld', externalId: String(parseMakerWorldUrl(url.href).designId) };
    } catch {
      throw invalid();
    }
  }
  if (PRINTABLES_HOSTS.has(url.hostname)) {
    return { platform: 'printables', externalId: idFrom(PRINTABLES_PATH, url.pathname) };
  }
  if (THINGIVERSE_HOSTS.has(url.hostname)) {
    return { platform: 'thingiverse', externalId: idFrom(THINGIVERSE_PATH, url.pathname) };
  }
  throw invalid();
}

// Door 3: URL canônica gravada em `model_url`.
export function canonicalModelUrl(identity: ModelIdentity): string {
  switch (identity.platform) {
    case 'printables':
      return `https://www.printables.com/model/${identity.externalId}`;
    case 'makerworld':
      return `https://makerworld.com/models/${identity.externalId}`;
    case 'thingiverse':
      return `https://www.thingiverse.com/thing:${identity.externalId}`;
  }
}

function idFrom(pattern: RegExp, pathname: string): string {
  const match = pattern.exec(pathname);
  const id = match ? Number(match[1]) : NaN;
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw invalid();
  }
  return String(id);
}

function invalid(): BadRequestException {
  return new BadRequestException(INVALID_MODEL_URL);
}
