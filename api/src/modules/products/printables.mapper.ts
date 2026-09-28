import { ModelMetadataError, unavailableMessage } from './model-metadata.error.js';
import type { ModelMetadataPreview } from './model-metadata.types.js';
import { normalizeLicense } from './license-normalization.js';

type Json = Record<string, unknown>;

const PLATFORM_LABEL = 'Printables';
const MEDIA_BASE_URL = 'https://media.printables.com/';

// Converte a resposta de `POST https://api.printables.com/graphql/` (query `print`). A API não é
// documentada: todo campo é lido como `unknown`. Só uma resposta que não parece um modelo é
// recusada (502) - a ausência do `id` do print.
export function mapPrintablesMetadata(raw: unknown): ModelMetadataPreview {
  const print = asRecord(raw);
  if (!print || toText(print.id) === null) {
    throw new ModelMetadataError(502, unavailableMessage(PLATFORM_LABEL));
  }
  const rawLicense = toText(asRecord(print.license)?.name);
  const { license, commercialUseAllowed } = normalizeLicense(rawLicense);
  return {
    title: toText(print.name),
    imageUrl: imageUrlOf(asRecord(print.image)),
    designer: toText(asRecord(print.user)?.publicUsername),
    license,
    commercialUseAllowed,
  };
}

function imageUrlOf(image: Json | null): string | null {
  const filePath = toText(image?.filePath);
  return filePath ? `${MEDIA_BASE_URL}${filePath}` : null;
}

function asRecord(value: unknown): Json | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : null;
}

function toText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}
