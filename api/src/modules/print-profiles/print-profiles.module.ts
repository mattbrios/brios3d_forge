import { Module } from '@nestjs/common';
import { HttpMakerWorldClient, MAKERWORLD_CLIENT } from './makerworld.client.js';
import { PrintProfilesController } from './print-profiles.controller.js';
import { PrintProfilesService } from './print-profiles.service.js';

@Module({
  controllers: [PrintProfilesController],
  providers: [
    PrintProfilesService,
    { provide: MAKERWORLD_CLIENT, useFactory: () => new HttpMakerWorldClient() },
  ],
})
export class PrintProfilesModule {}
