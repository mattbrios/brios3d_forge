import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Printer } from './entities/printer.entity.js';
import { PrintersController } from './printers.controller.js';
import { PrintersService } from './printers.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Printer])],
  controllers: [PrintersController],
  providers: [PrintersService],
  // Fase 12 (quote-preview): QuotePreviewService precisa resolver o printerId recebido.
  exports: [PrintersService],
})
export class PrintersModule {}
