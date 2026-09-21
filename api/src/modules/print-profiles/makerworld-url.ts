import { INVALID_URL_MESSAGE, PrintProfileError } from './print-profile.error.js';

export interface MakerWorldUrl {
  designId: number;
  profileId: number | null;
}

const HOSTS = new Set(['makerworld.com', 'www.makerworld.com']);
// Prefixo de idioma opcional (/pt/, /en/, /zh-cn/), número do modelo e slug opcional.
const MODEL_PATH = /^\/(?:[a-z]{2}(?:-[a-z]{2,4})?\/)?models\/(\d+)(?:-[^/]*)?\/?$/i;
const PROFILE_FRAGMENT = /^#profileId-(\d+)$/;

export function parseMakerWorldUrl(input: string): MakerWorldUrl {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw invalid();
  }
  if (
    url.protocol !== 'https:' ||
    !HOSTS.has(url.hostname) ||
    url.port !== '' ||
    url.username !== '' ||
    url.password !== ''
  ) {
    throw invalid();
  }
  const path = MODEL_PATH.exec(url.pathname);
  const designId = path ? Number(path[1]) : NaN;
  if (!Number.isSafeInteger(designId) || designId <= 0) {
    throw invalid();
  }
  // Fragmento fora do formato é ignorado: vale o perfil padrão do modelo.
  const profile = PROFILE_FRAGMENT.exec(url.hash);
  const profileId = profile ? Number(profile[1]) : NaN;
  return {
    designId,
    profileId: Number.isSafeInteger(profileId) && profileId > 0 ? profileId : null,
  };
}

function invalid(): PrintProfileError {
  return new PrintProfileError(400, INVALID_URL_MESSAGE);
}
