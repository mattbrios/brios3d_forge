import { Module } from '@nestjs/common';
import { HttpMakerWorldClient, MAKERWORLD_CLIENT } from './makerworld.client.js';
import { PrintProfilesController } from './print-profiles.controller.js';
import { PrintProfilesService } from './print-profiles.service.js';

// Fase 14: exporta o token para o ProductsModule reaproveitar o mesmo cliente HTTP.
@Module({
  controllers: [PrintProfilesController],
  providers: [
    PrintProfilesService,
    { provide: MAKERWORLD_CLIENT, useFactory: () => new HttpMakerWorldClient() },
  ],
  exports: [MAKERWORLD_CLIENT],
})
export class PrintProfilesModule {}
