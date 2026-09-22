import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';
import { FixedCostItem } from './entities/fixed-cost-item.entity.js';
import { SETTINGS_ID, Settings } from './entities/settings.entity.js';
import { EMPTY_SETTINGS_PATCH, type SettingsResponse, toSettingsResponse } from './settings.types.js';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Settings) private readonly settings: Repository<Settings>,
    @InjectRepository(FixedCostItem) private readonly fixedCostItems: Repository<FixedCostItem>,
  ) {}

  async get(): Promise<SettingsResponse> {
    const [row, items] = await Promise.all([
      this.settings.findOneOrFail({ where: { id: SETTINGS_ID } }),
      this.fixedCostItems.find({ where: { settingsId: SETTINGS_ID }, order: { name: 'ASC' } }),
    ]);
    return toSettingsResponse(row, items);
  }

  async update(dto: UpdateSettingsDto): Promise<SettingsResponse> {
    if (
      dto.energyTariffCentsPerKwh === undefined &&
      dto.laborCentsPerHour === undefined &&
      dto.defaultMarginRate === undefined &&
      dto.failureRate === undefined &&
      dto.purgeRate === undefined &&
      dto.maintenanceCentsPerHour === undefined &&
      dto.productiveHoursPerMonth === undefined &&
      dto.fixedCostItems === undefined
    ) {
      throw new BadRequestException(EMPTY_SETTINGS_PATCH);
    }

    const [row, items] = await this.settings.manager.transaction(async (manager) => {
      const repo = manager.getRepository(Settings);
      const current = await repo.findOneOrFail({ where: { id: SETTINGS_ID } });

      if (dto.energyTariffCentsPerKwh !== undefined) current.energyTariffCentsPerKwh = dto.energyTariffCentsPerKwh;
      if (dto.laborCentsPerHour !== undefined) current.laborCentsPerHour = dto.laborCentsPerHour;
      if (dto.defaultMarginRate !== undefined) current.defaultMarginRate = dto.defaultMarginRate;
      if (dto.failureRate !== undefined) current.failureRate = dto.failureRate;
      if (dto.purgeRate !== undefined) current.purgeRate = dto.purgeRate;
      if (dto.maintenanceCentsPerHour !== undefined) current.maintenanceCentsPerHour = dto.maintenanceCentsPerHour;
      if (dto.productiveHoursPerMonth !== undefined) current.productiveHoursPerMonth = dto.productiveHoursPerMonth;
      await repo.save(current);

      const itemsRepo = manager.getRepository(FixedCostItem);
      if (dto.fixedCostItems !== undefined) {
        // Substituição total (door 2): apaga tudo e regrava, nunca um merge.
        await itemsRepo.delete({ settingsId: SETTINGS_ID });
        if (dto.fixedCostItems.length > 0) {
          await itemsRepo.insert(
            dto.fixedCostItems.map((item) => ({
              settingsId: SETTINGS_ID,
              name: item.name,
              monthlyCents: item.monthlyCents,
            })),
          );
        }
      }

      const currentItems = await itemsRepo.find({ where: { settingsId: SETTINGS_ID }, order: { name: 'ASC' } });
      return [current, currentItems] as const;
    });

    return toSettingsResponse(row, items);
  }
}
