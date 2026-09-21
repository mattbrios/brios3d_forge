import {
  BadGatewayException,
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpException,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { ImportPrintProfileDto } from './dto/import-print-profile.dto.js';
import { PrintProfileError } from './print-profile.error.js';
import { PrintProfilesService } from './print-profiles.service.js';
import type { PrintProfileImport } from './print-profiles.types.js';

@Controller('print-profiles')
export class PrintProfilesController {
  constructor(private readonly printProfilesService: PrintProfilesService) {}

  // Só lê o MakerWorld e devolve os dados, sem criar recurso: responde 200.
  @Post('import')
  @HttpCode(200)
  async import(@Body() dto: ImportPrintProfileDto): Promise<PrintProfileImport> {
    try {
      return await this.printProfilesService.importFromUrl(dto.url);
    } catch (error) {
      if (error instanceof PrintProfileError) {
        throw toHttpException(error);
      }
      throw error;
    }
  }
}

export function toHttpException(error: PrintProfileError): HttpException {
  switch (error.status) {
    case 400:
      return new BadRequestException(error.message);
    case 404:
      return new NotFoundException(error.message);
    case 502:
      return new BadGatewayException(error.message);
  }
}
