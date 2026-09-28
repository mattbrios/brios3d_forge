import { Inject, Injectable } from '@nestjs/common';
import { mapMakerWorldDesign } from '../print-profiles/makerworld-design.mapper.js';
import { MAKERWORLD_CLIENT, type MakerWorldClient } from '../print-profiles/makerworld.client.js';
import { PrintProfileError } from '../print-profiles/print-profile.error.js';
import { normalizeLicense } from './license-normalization.js';
import { ModelMetadataError, THINGIVERSE_NOT_SUPPORTED } from './model-metadata.error.js';
import type { ModelMetadataPreview } from './model-metadata.types.js';
import { parseModelUrl } from './model-url.js';
import { mapPrintablesMetadata } from './printables.mapper.js';
import { PRINTABLES_CLIENT, type PrintablesClient } from './printables.client.js';

// Door do Flow (plano da Fase 14): nada é gravado aqui. Preview e refresh chamam este mesmo
// serviço; quem grava é ProductsService.refreshMetadata.
@Injectable()
export class ModelMetadataService {
  constructor(
    @Inject(PRINTABLES_CLIENT) private readonly printables: PrintablesClient,
    @Inject(MAKERWORLD_CLIENT) private readonly makerworld: MakerWorldClient,
  ) {}

  async fetchByUrl(modelUrl: string): Promise<ModelMetadataPreview> {
    const identity = parseModelUrl(modelUrl);
    switch (identity.platform) {
      case 'printables':
        return this.fetchPrintables(identity.externalId);
      case 'makerworld':
        return this.fetchMakerWorld(identity.externalId);
      case 'thingiverse':
        throw new ModelMetadataError(400, THINGIVERSE_NOT_SUPPORTED);
    }
  }

  private async fetchPrintables(externalId: string): Promise<ModelMetadataPreview> {
    const raw = await this.printables.fetchModel(externalId);
    return mapPrintablesMetadata(raw);
  }

  private async fetchMakerWorld(externalId: string): Promise<ModelMetadataPreview> {
    const designId = Number(externalId);
    try {
      const raw = await this.makerworld.fetchDesign(designId);
      const { model } = mapMakerWorldDesign(raw, designId, null);
      const { license, commercialUseAllowed } = normalizeLicense(model.license);
      return {
        title: model.title,
        imageUrl: model.coverUrl,
        designer: model.designer,
        license,
        commercialUseAllowed,
      };
    } catch (error) {
      throw toModelMetadataError(error);
    }
  }
}

// O client e o mapper do MakerWorld (Fase 2) lançam PrintProfileError; a Fase 14 fala só
// ModelMetadataError, então a fronteira entre os dois módulos fica neste ponto único.
function toModelMetadataError(error: unknown): unknown {
  if (error instanceof PrintProfileError) {
    return new ModelMetadataError(error.status, error.message);
  }
  return error;
}
