import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdjustHourmeterDto } from './dto/adjust-hourmeter.dto.js';
import { CreatePrinterDto } from './dto/create-printer.dto.js';
import { ListPrintersDto } from './dto/list-printers.dto.js';
import { UpdatePrinterDto } from './dto/update-printer.dto.js';
import { Printer } from './entities/printer.entity.js';
import {
  AMS_SLOTS_REQUIRED,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  type ListPrintersResponse,
  PRINTER_NOT_FOUND,
  type PrinterResponse,
  toPrinterResponse,
} from './printers.types.js';

// Escapa os curingas do ILIKE para o texto do usuário virar uma substring literal.
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

@Injectable()
export class PrintersService {
  constructor(@InjectRepository(Printer) private readonly printers: Repository<Printer>) {}

  async list(query: ListPrintersDto): Promise<ListPrintersResponse> {
    const page = query.page ?? DEFAULT_PAGE;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

    const qb = this.printers
      .createQueryBuilder('printer')
      .orderBy('printer.name', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (query.search !== undefined) {
      qb.andWhere('printer.name ILIKE :search', { search: `%${escapeLike(query.search)}%` });
    }
    if (query.hasAms !== undefined) {
      qb.andWhere('printer.has_ams = :hasAms', { hasAms: query.hasAms });
    }

    const [rows, total] = await qb.getManyAndCount();
    return { items: rows.map(toPrinterResponse), total, page, pageSize };
  }

  // Consumido pela Fase 12 (quote-preview) para validar o printerId recebido no corpo.
  async getById(id: string): Promise<PrinterResponse> {
    const printer = await this.printers.findOne({ where: { id } });
    if (!printer) {
      throw new NotFoundException(PRINTER_NOT_FOUND);
    }
    return toPrinterResponse(printer);
  }

  async create(dto: CreatePrinterDto): Promise<PrinterResponse> {
    if (dto.hasAms && (dto.amsSlots === undefined || dto.amsSlots < 1)) {
      throw new BadRequestException(AMS_SLOTS_REQUIRED);
    }

    const created = await this.printers.save(
      this.printers.create({
        name: dto.name,
        acquisitionCostCents: dto.acquisitionCostCents,
        lifespanHours: dto.lifespanHours,
        powerWatts: dto.powerWatts,
        hourmeterHours: dto.hourmeterHours ?? 0,
        nozzles: dto.nozzles,
        hasAms: dto.hasAms,
        amsSlots: dto.hasAms ? (dto.amsSlots ?? null) : null,
        active: true,
      }),
    );
    return toPrinterResponse(created);
  }

  async update(id: string, dto: UpdatePrinterDto): Promise<PrinterResponse> {
    return this.printers.manager.transaction(async (manager) => {
      const repo = manager.getRepository(Printer);
      const printer = await repo.findOne({ where: { id } });
      if (!printer) {
        throw new NotFoundException(PRINTER_NOT_FOUND);
      }

      // Valida com o valor final de hasAms/amsSlots, enviado ou já gravado (mesmo padrão do
      // needsDrying de materials, AC 19).
      const finalHasAms = dto.hasAms ?? printer.hasAms;
      const finalAmsSlots = dto.amsSlots ?? printer.amsSlots ?? undefined;
      if (finalHasAms && (finalAmsSlots === undefined || finalAmsSlots < 1)) {
        throw new BadRequestException(AMS_SLOTS_REQUIRED);
      }

      if (dto.name !== undefined) printer.name = dto.name;
      if (dto.acquisitionCostCents !== undefined) printer.acquisitionCostCents = dto.acquisitionCostCents;
      if (dto.lifespanHours !== undefined) printer.lifespanHours = dto.lifespanHours;
      if (dto.powerWatts !== undefined) printer.powerWatts = dto.powerWatts;
      if (dto.nozzles !== undefined) printer.nozzles = dto.nozzles;
      if (dto.active !== undefined) printer.active = dto.active;
      printer.hasAms = finalHasAms;
      // WHILE hasAms for false, amsSlots fica null (AC 7), mantido também no PATCH.
      printer.amsSlots = finalHasAms ? (finalAmsSlots ?? null) : null;

      await repo.save(printer);
      return toPrinterResponse(printer);
    });
  }

  async adjustHourmeter(id: string, dto: AdjustHourmeterDto): Promise<PrinterResponse> {
    const printer = await this.printers.findOne({ where: { id } });
    if (!printer) {
      throw new NotFoundException(PRINTER_NOT_FOUND);
    }
    printer.hourmeterHours = dto.hourmeterHours;
    await this.printers.save(printer);
    return toPrinterResponse(printer);
  }
}
