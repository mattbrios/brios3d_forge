import { Inject, Injectable } from '@nestjs/common';
import { mapMakerWorldDesign } from './makerworld-design.mapper.js';
import { parseMakerWorldUrl } from './makerworld-url.js';
import { MAKERWORLD_CLIENT, type MakerWorldClient } from './makerworld.client.js';
import type { PrintProfileImport } from './print-profiles.types.js';

@Injectable()
export class PrintProfilesService {
  constructor(@Inject(MAKERWORLD_CLIENT) private readonly client: MakerWorldClient) {}

  // Nada é gravado. A URL recebida nunca vira a URL da requisição: só o designId numérico.
  async importFromUrl(url: string): Promise<PrintProfileImport> {
    const { designId, profileId } = parseMakerWorldUrl(url);
    const design = await this.client.fetchDesign(designId);
    return mapMakerWorldDesign(design, designId, profileId);
  }
}
