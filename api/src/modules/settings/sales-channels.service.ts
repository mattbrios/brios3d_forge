import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUniqueViolation } from '../users/is-unique-violation.js';
import { CreateSalesChannelDto } from './dto/create-sales-channel.dto.js';
import { UpdateSalesChannelDto } from './dto/update-sales-channel.dto.js';
import { SalesChannel } from './entities/sales-channel.entity.js';
import { SETTINGS_ID, Settings } from './entities/settings.entity.js';
import {
  CHANNEL_NOT_FOUND,
  COMBINED_RATE_TOO_HIGH,
  DUPLICATE_CHANNEL_NAME,
  type SalesChannelResponse,
  toSalesChannelResponse,
} from './settings.types.js';

@Injectable()
export class SalesChannelsService {
  constructor(
    @InjectRepository(SalesChannel) private readonly channels: Repository<SalesChannel>,
    @InjectRepository(Settings) private readonly settings: Repository<Settings>,
  ) {}

  async list(): Promise<SalesChannelResponse[]> {
    const rows = await this.channels.find({ order: { name: 'ASC' } });
    return rows.map(toSalesChannelResponse);
  }

  // Consumido pela Fase 12 (quote-preview) para validar o channelId recebido no corpo.
  async getById(id: string): Promise<SalesChannelResponse> {
    const channel = await this.channels.findOne({ where: { id } });
    if (!channel) {
      throw new NotFoundException(CHANNEL_NOT_FOUND);
    }
    return toSalesChannelResponse(channel);
  }

  async create(dto: CreateSalesChannelDto): Promise<SalesChannelResponse> {
    const settings = await this.settings.findOneOrFail({ where: { id: SETTINGS_ID } });
    if (settings.defaultMarginRate + dto.taxRate + dto.feeRate >= 1) {
      throw new BadRequestException(COMBINED_RATE_TOO_HIGH);
    }
    try {
      const created = await this.channels.save(
        this.channels.create({ name: dto.name, taxRate: dto.taxRate, feeRate: dto.feeRate, active: true }),
      );
      return toSalesChannelResponse(created);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(DUPLICATE_CHANNEL_NAME);
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateSalesChannelDto): Promise<SalesChannelResponse> {
    return this.channels.manager.transaction(async (manager) => {
      const repo = manager.getRepository(SalesChannel);
      const channel = await repo.findOne({ where: { id } });
      if (!channel) {
        throw new NotFoundException(CHANNEL_NOT_FOUND);
      }

      // Valida com o valor final de cada campo, alterado ou não (AC 22).
      const finalTaxRate = dto.taxRate ?? channel.taxRate;
      const finalFeeRate = dto.feeRate ?? channel.feeRate;
      const settings = await manager.getRepository(Settings).findOneOrFail({ where: { id: SETTINGS_ID } });
      if (settings.defaultMarginRate + finalTaxRate + finalFeeRate >= 1) {
        throw new BadRequestException(COMBINED_RATE_TOO_HIGH);
      }

      if (dto.name !== undefined) channel.name = dto.name;
      if (dto.taxRate !== undefined) channel.taxRate = dto.taxRate;
      if (dto.feeRate !== undefined) channel.feeRate = dto.feeRate;
      if (dto.active !== undefined) channel.active = dto.active;

      try {
        await repo.save(channel);
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictException(DUPLICATE_CHANNEL_NAME);
        }
        throw error;
      }
      return toSalesChannelResponse(channel);
    });
  }
}
