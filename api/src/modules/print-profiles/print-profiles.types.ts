// Contrato de `POST /print-profiles/import` (door 1 do plano). Tempo em segundos inteiros,
// pesos em gramas, comprimentos em metros, percentuais como fração. Campo que o MakerWorld
// não informa volta null.

export interface PrintProfileFilament {
  slot: number;
  type: string | null;
  color: string | null;
  grams: number | null;
  meters: number | null;
}

export interface PrintProfilePlate {
  index: number;
  printSeconds: number | null;
  totalGrams: number | null;
  filaments: PrintProfileFilament[];
}

export interface PrintProfile {
  id: number;
  title: string | null;
  printSeconds: number | null;
  totalGrams: number | null;
  needsAms: boolean | null;
  printer: { name: string | null; nozzleDiameterMm: number | null };
  settings: {
    layerHeightMm: number | null;
    wallLoops: number | null;
    sparseInfillRate: number | null;
  };
  filaments: PrintProfileFilament[];
  plates: PrintProfilePlate[];
}

export interface PrintProfileImport {
  source: { platform: 'makerworld'; designId: number; url: string };
  model: {
    title: string | null;
    coverUrl: string | null;
    license: string | null;
    designer: string | null;
  };
  selectedProfileId: number | null;
  profiles: PrintProfile[];
}
