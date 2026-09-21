import { PrintProfileError, UNAVAILABLE_MESSAGE } from './print-profile.error.js';
import type {
  PrintProfile,
  PrintProfileFilament,
  PrintProfileImport,
  PrintProfilePlate,
} from './print-profiles.types.js';

type Json = Record<string, unknown>;

// Converte a resposta de `GET /api/v1/design-service/design/<id>` do MakerWorld. A API não é
// documentada: todo campo é lido como `unknown`, e o que faltar ou vier num formato inesperado
// vira null em vez de erro. Só uma resposta que não parece um modelo é recusada (502).
export function mapMakerWorldDesign(
  raw: unknown,
  designId: number,
  profileId: number | null,
): PrintProfileImport {
  const design = asRecord(raw);
  if (!design || !isPositiveInteger(design.id)) {
    throw new PrintProfileError(502, UNAVAILABLE_MESSAGE);
  }

  const profiles = asArray(design.instances)
    .map(asRecord)
    .filter((instance): instance is Json => instance !== null && isPositiveInteger(instance.id))
    .map(mapProfile);

  return {
    source: {
      platform: 'makerworld',
      designId,
      url: `https://makerworld.com/models/${designId}`,
    },
    model: {
      title: toText(design.title),
      coverUrl: toText(design.coverUrl),
      license: toText(design.license),
      designer: toText(asRecord(design.designCreator)?.name),
    },
    selectedProfileId: selectProfile(profiles, design.defaultInstanceId, designId, profileId),
    profiles,
  };
}

function selectProfile(
  profiles: PrintProfile[],
  defaultInstanceId: unknown,
  designId: number,
  profileId: number | null,
): number | null {
  const ids = profiles.map((profile) => profile.id);
  if (profileId !== null) {
    if (!ids.includes(profileId)) {
      throw new PrintProfileError(
        400,
        `Perfil ${profileId} não existe no modelo ${designId}. Remova o #profileId da URL para ver os perfis disponíveis`,
      );
    }
    return profileId;
  }
  if (typeof defaultInstanceId === 'number' && ids.includes(defaultInstanceId)) {
    return defaultInstanceId;
  }
  return ids[0] ?? null;
}

function mapProfile(instance: Json): PrintProfile {
  const modelInfo = asRecord(asRecord(instance.extention)?.modelInfo);
  const compatibility = asRecord(modelInfo?.compatibility);
  const settings = asRecord(modelInfo?.projectSettings);
  const plates = asArray(modelInfo?.plates)
    .map(asRecord)
    .filter((plate): plate is Json => plate !== null)
    .map(mapPlate);

  return {
    id: instance.id as number,
    title: toText(instance.title),
    printSeconds: toNonNegative(instance.prediction),
    totalGrams: toNonNegative(instance.weight),
    needsAms: typeof instance.needAms === 'boolean' ? instance.needAms : null,
    printer: {
      name: toText(compatibility?.devProductName),
      nozzleDiameterMm: toNonNegative(compatibility?.nozzleDiameter),
    },
    settings: {
      layerHeightMm: toNonNegative(settings?.layerHeight),
      wallLoops: toInteger(settings?.wallLoops),
      sparseInfillRate: toRate(settings?.sparseInfillDensity),
    },
    filaments:
      plates.length > 0
        ? sumBySlot(plates.flatMap((plate) => plate.filaments))
        : instanceFilaments(instance.instanceFilaments),
    plates,
  };
}

function mapPlate(plate: Json, position: number): PrintProfilePlate {
  return {
    index: isPositiveInteger(plate.index) ? plate.index : position + 1,
    printSeconds: toNonNegative(plate.prediction),
    totalGrams: toNonNegative(plate.weight),
    filaments: asArray(plate.filaments)
      .map(asRecord)
      .filter((filament): filament is Json => filament !== null)
      .flatMap((filament) => {
        const slot = toInteger(filament.id);
        return slot !== null && slot > 0 ? [mapFilament(filament, slot)] : [];
      }),
  };
}

// Sem placas, os filamentos do perfil vêm de `instanceFilaments`, que não traz o slot.
function instanceFilaments(value: unknown): PrintProfileFilament[] {
  return asArray(value)
    .map(asRecord)
    .filter((filament): filament is Json => filament !== null)
    .map((filament, position) => mapFilament(filament, position + 1));
}

function mapFilament(filament: Json, slot: number): PrintProfileFilament {
  return {
    slot,
    type: toText(filament.type),
    color: toColor(filament.color),
    grams: toNonNegative(filament.usedG),
    meters: toNonNegative(filament.usedM),
  };
}

// Soma os filamentos das placas por slot, em ordem de slot. Um valor null em qualquer placa
// deixa o total null: um total parcial pareceria completo.
function sumBySlot(filaments: PrintProfileFilament[]): PrintProfileFilament[] {
  const bySlot = new Map<number, PrintProfileFilament>();
  for (const filament of filaments) {
    const current = bySlot.get(filament.slot);
    if (!current) {
      bySlot.set(filament.slot, { ...filament });
      continue;
    }
    current.type ??= filament.type;
    current.color ??= filament.color;
    current.grams = sumOrNull(current.grams, filament.grams);
    current.meters = sumOrNull(current.meters, filament.meters);
  }
  return [...bySlot.values()].sort((a, b) => a.slot - b.slot);
}

function sumOrNull(a: number | null, b: number | null): number | null {
  return a === null || b === null ? null : a + b;
}

function asRecord(value: unknown): Json | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Json)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function toText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

// Aceita número ou texto numérico ("8", "2.66"). Negativo, vazio ou não numérico vira null.
function toNonNegative(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  if (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value.trim())) {
    return Number(value.trim());
  }
  return null;
}

function toInteger(value: unknown): number | null {
  const number = toNonNegative(value);
  return number !== null && Number.isInteger(number) ? number : null;
}

// "15%" -> 0.15. Sem o sinal de porcentagem a unidade é ambígua, então vira null.
function toRate(value: unknown): number | null {
  if (typeof value !== 'string') {
    return null;
  }
  const match = /^(\d+(?:\.\d+)?)%$/.exec(value.trim());
  const percent = match ? Number(match[1]) : NaN;
  return percent >= 0 && percent <= 100 ? percent / 100 : null;
}

// "#RRGGBB" em maiúsculas. "#RRGGBBAA" perde o canal alfa.
function toColor(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const match = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(value.trim());
  return match ? `#${match[1].toUpperCase()}` : null;
}
