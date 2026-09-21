import { design3007827 } from './fixtures/design-3007827.js';
import { mapMakerWorldDesign } from './makerworld-design.mapper.js';
import { PrintProfileError } from './print-profile.error.js';
import type { PrintProfile } from './print-profiles.types.js';

type Json = Record<string, unknown>;

const UNAVAILABLE = 'Não foi possível consultar o MakerWorld agora. Preencha os dados manualmente';

const SEA_STAR_FILAMENTS = [
  { slot: 1, type: 'PLA', color: '#FD8008', grams: 8, meters: 2.66 },
  { slot: 4, type: 'PLA', color: '#000000', grams: 1, meters: 0.08 },
];

function seaStar(): PrintProfile {
  return {
    id: 3387944,
    title: 'Sea star',
    printSeconds: 1707,
    totalGrams: 9,
    needsAms: true,
    printer: { name: 'X2D', nozzleDiameterMm: 0.4 },
    settings: { layerHeightMm: 0.2, wallLoops: 2, sparseInfillRate: 0.15 },
    filaments: structuredClone(SEA_STAR_FILAMENTS),
    plates: [
      { index: 1, printSeconds: 1707, totalGrams: 9, filaments: structuredClone(SEA_STAR_FILAMENTS) },
    ],
  };
}

const MODEL = {
  title: 'Sea animals - set',
  coverUrl:
    'https://makerworld.bblmw.com/makerworld/model/USafe737868bbaa/design/6c21105d01a14e2f.jpeg',
  license: 'Standard Digital File License',
  designer: 'Real_Prints',
};

// Caminhos dentro da fixture. O Sea star é o primeiro item de `instances`.
function instance(raw: Json, id: number): Json {
  return (raw.instances as Json[]).find((item) => item.id === id) as Json;
}
function modelInfo(raw: Json, id = 3387944): Json {
  return (instance(raw, id).extention as Json).modelInfo as Json;
}
function firstPlate(raw: Json): Json {
  return (modelInfo(raw).plates as Json[])[0];
}
function firstPlateFilament(raw: Json): Json {
  return (firstPlate(raw).filaments as Json[])[0];
}

function profileOf(raw: Json, id: number): PrintProfile {
  const result = mapMakerWorldDesign(raw, 3007827, id);
  return result.profiles.find((profile) => profile.id === id) as PrintProfile;
}

function errorOf(fn: () => unknown): PrintProfileError {
  try {
    fn();
  } catch (error) {
    if (error instanceof PrintProfileError) {
      return error;
    }
    throw error;
  }
  throw new Error('expected PrintProfileError');
}

describe('mapMakerWorldDesign', () => {
  it('maps the sea star profile', () => {
    const result = mapMakerWorldDesign(design3007827(), 3007827, 3387944);
    expect(result.selectedProfileId).toBe(3387944);
    const profile = result.profiles.find((item) => item.id === 3387944);
    expect(profile?.title).toBe('Sea star');
    expect(profile?.printSeconds).toBe(1707);
    expect(profile?.totalGrams).toBe(9);
    expect(profile?.needsAms).toBe(true);
    expect(profile?.printer).toEqual({ name: 'X2D', nozzleDiameterMm: 0.4 });
    expect(profile?.settings).toEqual({ layerHeightMm: 0.2, wallLoops: 2, sparseInfillRate: 0.15 });
  });

  it('sea star filaments by slot', () => {
    const profile = profileOf(design3007827(), 3387944);
    expect(profile.filaments).toEqual(SEA_STAR_FILAMENTS);
    expect(profile.plates).toEqual([
      { index: 1, printSeconds: 1707, totalGrams: 9, filaments: SEA_STAR_FILAMENTS },
    ]);
  });

  it('maps model and source', () => {
    const result = mapMakerWorldDesign(design3007827(), 3007827, 3387944);
    expect(result.model).toEqual(MODEL);
    expect(result.source).toEqual({
      platform: 'makerworld',
      designId: 3007827,
      url: 'https://makerworld.com/models/3007827',
    });
  });

  it('sums plate filaments by slot', () => {
    const profile = profileOf(design3007827(), 3377800);
    expect(profile.plates).toHaveLength(11);
    expect(profile.plates.map((plate) => plate.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(profile.printSeconds).toBe(77054);
    expect(profile.totalGrams).toBe(408);
    expect(
      profile.filaments.map(({ slot, type, color, grams }) => ({ slot, type, color, grams })),
    ).toEqual([
      { slot: 1, type: 'PLA', color: '#FECC66', grams: 246 },
      { slot: 2, type: 'PLA', color: '#000000', grams: 64 },
      { slot: 3, type: 'PLA', color: '#66CCFF', grams: 37 },
      { slot: 4, type: 'PLA', color: '#66FF66', grams: 61 },
    ]);
    const meters = [79.82, 19.42, 11.86, 19.62];
    profile.filaments.forEach((filament, i) => {
      expect(Math.abs((filament.meters as number) - meters[i])).toBeLessThan(1e-9);
    });
  });

  it('defaults to the default instance', () => {
    expect(mapMakerWorldDesign(design3007827(), 3007827, null).selectedProfileId).toBe(3377800);
  });

  it('keeps profile order', () => {
    const result = mapMakerWorldDesign(design3007827(), 3007827, null);
    expect(result.profiles.map((profile) => profile.id)).toEqual([3387944, 3388305, 3377800]);
  });

  it('needs ams false', () => {
    expect(profileOf(design3007827(), 3388305).needsAms).toBe(false);
  });

  it('missing field becomes null', () => {
    type Case = {
      field: string;
      remove: (raw: Json) => void;
      expectModel?: (model: typeof MODEL) => void;
      expectProfile?: (profile: PrintProfile) => void;
    };
    const cases: Case[] = [
      { field: 'model.title', remove: (raw) => delete raw.title },
      { field: 'model.coverUrl', remove: (raw) => delete raw.coverUrl },
      { field: 'model.license', remove: (raw) => delete raw.license },
      { field: 'model.designer', remove: (raw) => delete (raw.designCreator as Json).name },
      { field: 'profile.title', remove: (raw) => delete instance(raw, 3387944).title },
      { field: 'profile.printSeconds', remove: (raw) => delete instance(raw, 3387944).prediction },
      { field: 'profile.totalGrams', remove: (raw) => delete instance(raw, 3387944).weight },
      { field: 'profile.needsAms', remove: (raw) => delete instance(raw, 3387944).needAms },
      {
        field: 'printer.name',
        remove: (raw) => delete (modelInfo(raw).compatibility as Json).devProductName,
      },
      {
        field: 'printer.nozzleDiameterMm',
        remove: (raw) => delete (modelInfo(raw).compatibility as Json).nozzleDiameter,
      },
      {
        field: 'settings.layerHeightMm',
        remove: (raw) => delete (modelInfo(raw).projectSettings as Json).layerHeight,
      },
      {
        field: 'settings.wallLoops',
        remove: (raw) => delete (modelInfo(raw).projectSettings as Json).wallLoops,
      },
      {
        field: 'settings.sparseInfillRate',
        remove: (raw) => delete (modelInfo(raw).projectSettings as Json).sparseInfillDensity,
      },
      { field: 'filament.type', remove: (raw) => delete firstPlateFilament(raw).type },
      { field: 'filament.color', remove: (raw) => delete firstPlateFilament(raw).color },
      { field: 'filament.grams', remove: (raw) => delete firstPlateFilament(raw).usedG },
      { field: 'filament.meters', remove: (raw) => delete firstPlateFilament(raw).usedM },
      { field: 'plate.printSeconds', remove: (raw) => delete firstPlate(raw).prediction },
      { field: 'plate.totalGrams', remove: (raw) => delete firstPlate(raw).weight },
    ];
    expect(cases).toHaveLength(19);

    for (const { field, remove } of cases) {
      const raw = design3007827();
      remove(raw);
      const result = mapMakerWorldDesign(raw, 3007827, 3387944);
      const profile = result.profiles.find((item) => item.id === 3387944) as PrintProfile;

      const expectedModel: Json = { ...MODEL };
      const expectedProfile = seaStar() as unknown as Json;
      const [scope, key] = field.split('.');
      if (scope === 'model') {
        expectedModel[key] = null;
      } else if (scope === 'profile') {
        expectedProfile[key] = null;
      } else if (scope === 'printer' || scope === 'settings') {
        (expectedProfile[scope] as Json)[key] = null;
      } else if (scope === 'filament') {
        // O slot 1 só aparece na placa 1, então o total do perfil também fica null.
        ((expectedProfile.filaments as Json[])[0] as Json)[key] = null;
        (((expectedProfile.plates as Json[])[0].filaments as Json[])[0] as Json)[key] = null;
      } else {
        ((expectedProfile.plates as Json[])[0] as Json)[key] = null;
      }

      expect(result.model, field).toEqual(expectedModel);
      expect(profile, field).toEqual(expectedProfile);
    }
  });

  it('invalid numbers become null', () => {
    for (const usedG of ['abc', '-1', '']) {
      const raw = design3007827();
      firstPlateFilament(raw).usedG = usedG;
      const profile = profileOf(raw, 3387944);
      expect(profile.plates[0].filaments[0].grams, usedG).toBeNull();
      expect(profile.filaments[0].grams, usedG).toBeNull();
    }
    for (const prediction of ['abc', -5]) {
      const raw = design3007827();
      instance(raw, 3387944).prediction = prediction;
      expect(profileOf(raw, 3387944).printSeconds, String(prediction)).toBeNull();
    }
    const meters = profileOf(design3007827(), 3387944).plates[0].filaments[0].meters;
    expect(meters).toBe(2.66);
    expect(typeof meters).toBe('number');
  });

  it('normalizes color and rates', () => {
    const colorOf = (color: string): string | null => {
      const raw = design3007827();
      firstPlateFilament(raw).color = color;
      return profileOf(raw, 3387944).plates[0].filaments[0].color;
    };
    expect(colorOf('#fd8008')).toBe('#FD8008');
    expect(colorOf('red')).toBeNull();
    expect(colorOf('#FD80')).toBeNull();

    const settingsWith = (patch: Json) => {
      const raw = design3007827();
      Object.assign(modelInfo(raw).projectSettings as Json, patch);
      return profileOf(raw, 3387944).settings;
    };
    expect(settingsWith({ sparseInfillDensity: '15%' }).sparseInfillRate).toBe(0.15);
    expect(settingsWith({ sparseInfillDensity: 'abc' }).sparseInfillRate).toBeNull();
    expect(settingsWith({ layerHeight: '0.2' }).layerHeightMm).toBe(0.2);
    expect(settingsWith({ wallLoops: '2' }).wallLoops).toBe(2);
  });

  it('falls back to instance filaments', () => {
    const raw = design3007827();
    delete modelInfo(raw).plates;
    const profile = profileOf(raw, 3387944);
    expect(profile.plates).toEqual([]);
    expect(profile.filaments).toEqual([
      { slot: 1, type: 'PLA', color: '#FD8008', grams: 8, meters: 2.66 },
      { slot: 2, type: 'PLA', color: '#000000', grams: 1, meters: 0.08 },
    ]);
  });

  it('model without profiles', () => {
    const empty = design3007827();
    empty.instances = [];
    const missing = design3007827();
    delete missing.instances;
    for (const raw of [empty, missing]) {
      const result = mapMakerWorldDesign(raw, 3007827, null);
      expect(result.profiles).toEqual([]);
      expect(result.selectedProfileId).toBeNull();
    }
  });

  it('unknown profile id', () => {
    const error = errorOf(() => mapMakerWorldDesign(design3007827(), 3007827, 999));
    expect(error.status).toBe(400);
    expect(error.message).toBe(
      'Perfil 999 não existe no modelo 3007827. Remova o #profileId da URL para ver os perfis disponíveis',
    );
  });

  it('unrecognized design is 502', () => {
    for (const raw of [[], null, 'texto', {}]) {
      const error = errorOf(() => mapMakerWorldDesign(raw, 3007827, null));
      expect(error.status, JSON.stringify(raw)).toBe(502);
      expect(error.message).toBe(UNAVAILABLE);
    }
  });

  it('falls back to the first profile', () => {
    const missing = design3007827();
    delete missing.defaultInstanceId;
    const unknown = design3007827();
    unknown.defaultInstanceId = 123;
    for (const raw of [missing, unknown]) {
      expect(mapMakerWorldDesign(raw, 3007827, null).selectedProfileId).toBe(3387944);
    }
  });

  it('null in one plate makes the slot total null', () => {
    const raw = design3007827();
    const plates = modelInfo(raw, 3377800).plates as Json[];
    const slotOne = (plates[1].filaments as Json[]).find((filament) => filament.id === '1') as Json;
    delete slotOne.usedG;
    delete slotOne.usedM;
    const profile = profileOf(raw, 3377800);
    const bySlot = new Map(profile.filaments.map((filament) => [filament.slot, filament]));
    expect(bySlot.get(1)?.grams).toBeNull();
    expect(bySlot.get(1)?.meters).toBeNull();
    expect(bySlot.get(2)?.grams).toBe(64);
    expect(bySlot.get(3)?.grams).toBe(37);
    expect(bySlot.get(4)?.grams).toBe(61);
  });

  it('identifiers are never null', () => {
    const raw = design3007827();
    const instances = raw.instances as Json[];
    instances.push({ ...instance(raw, 3388305), id: undefined }, { title: 'sem id' });
    const plate = firstPlate(raw);
    delete plate.index;
    (plate.filaments as Json[]).push(
      { id: 'abc', type: 'PLA', color: '#FFFFFF', usedG: '1', usedM: '0.1' },
      { id: '0', type: 'PLA', color: '#FFFFFF', usedG: '1', usedM: '0.1' },
      { type: 'PLA', color: '#FFFFFF', usedG: '1', usedM: '0.1' },
    );

    const result = mapMakerWorldDesign(raw, 3007827, 3387944);
    expect(result.profiles.map((profile) => profile.id)).toEqual([3387944, 3388305, 3377800]);
    const seaStarProfile = result.profiles[0];
    expect(seaStarProfile.plates.map((item) => item.index)).toEqual([1]);
    expect(seaStarProfile.plates[0].filaments.map((filament) => filament.slot)).toEqual([1, 4]);
    expect(seaStarProfile.filaments.map((filament) => filament.slot)).toEqual([1, 4]);

    const second = design3007827();
    const secondPlate = (modelInfo(second, 3377800).plates as Json[])[1];
    delete secondPlate.index;
    expect(profileOf(second, 3377800).plates[1].index).toBe(2);
  });

  it('each plate keeps its own filament values', () => {
    const profile = profileOf(design3007827(), 3377800);
    const gramsOf = (index: number) =>
      profile.plates[index - 1].filaments.map(({ slot, grams, meters }) => [slot, grams, meters]);
    expect(gramsOf(1)).toEqual([
      [1, 19, 6.19],
      [2, 12, 3.82],
      [3, 7, 2.3],
    ]);
    expect(gramsOf(10)).toEqual([
      [1, 41, 13.46],
      [2, 7, 2.13],
      [4, 30, 9.85],
    ]);
  });

  it('profile filaments are ordered by slot', () => {
    const raw = design3007827();
    const plates = modelInfo(raw, 3377800).plates as Json[];
    plates[0].filaments = (plates[0].filaments as Json[]).filter((filament) => filament.id !== '1');
    const profile = profileOf(raw, 3377800);
    expect(profile.filaments.map(({ slot, grams }) => [slot, grams])).toEqual([
      [1, 227],
      [2, 64],
      [3, 37],
      [4, 61],
    ]);
  });
});
