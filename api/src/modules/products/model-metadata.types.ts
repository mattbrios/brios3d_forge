// Contrato de `POST /products/model-metadata` (Fase 14, S1). Nada é gravado ao chamar esta rota.
export interface ModelMetadataPreview {
  title: string | null;
  imageUrl: string | null;
  designer: string | null;
  license: string | null;
  commercialUseAllowed: boolean | null;
}
