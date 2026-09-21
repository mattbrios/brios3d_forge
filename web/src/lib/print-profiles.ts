// Contrato de POST /print-profiles/import (espelha api/src/modules/print-profiles/print-profiles.types.ts).

export interface PrintProfileFilament {
  slot: number;
  type: string | null;
  color: string | null;
  grams: number | null;
  meters: number | null;
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
  plates: {
    index: number;
    printSeconds: number | null;
    totalGrams: number | null;
    filaments: PrintProfileFilament[];
  }[];
}

export interface PrintProfileImportResult {
  source: { platform: "makerworld"; designId: number; url: string };
  model: {
    title: string | null;
    coverUrl: string | null;
    license: string | null;
    designer: string | null;
  };
  selectedProfileId: number | null;
  profiles: PrintProfile[];
}
