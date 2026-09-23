import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateMaterialDto } from './dto/create-material.dto.js';
import { ListMaterialsDto } from './dto/list-materials.dto.js';
import { UpdateMaterialDto } from './dto/update-material.dto.js';
import { Material } from './entities/material.entity.js';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  INVALID_DRYING_PARAMS,
  type ListMaterialsResponse,
  MATERIAL_NOT_FOUND,
  type MaterialResponse,
  toMaterialResponse,
} from './materials.types.js';

// Escapa os curingas do ILIKE para o texto do usuário virar uma substring literal.
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

@Injectable()
export class MaterialsService {
  constructor(@InjectRepository(Material) private readonly materials: Repository<Material>) {}

  async list(query: ListMaterialsDto): Promise<ListMaterialsResponse> {
    const page = query.page ?? DEFAULT_PAGE;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

    const qb = this.materials
      .createQueryBuilder('material')
      .orderBy('material.type', 'ASC')
      .addOrderBy('material.brand', 'ASC')
      .addOrderBy('material.color', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (query.type !== undefined) {
      qb.andWhere('material.type ILIKE :type', { type: escapeLike(query.type) });
    }
    if (query.search !== undefined) {
      qb.andWhere(
        '(material.type ILIKE :search OR material.brand ILIKE :search OR material.color ILIKE :search)',
        { search: `%${escapeLike(query.search)}%` },
      );
    }

    const [rows, total] = await qb.getManyAndCount();
    return { items: rows.map(toMaterialResponse), total, page, pageSize };
  }

  async create(dto: CreateMaterialDto): Promise<MaterialResponse> {
    const drying = dto.needsDrying
      ? { dryingTemperatureC: dto.dryingTemperatureC ?? null, dryingHours: dto.dryingHours ?? null }
      : { dryingTemperatureC: null, dryingHours: null };

    const created = await this.materials.save(
      this.materials.create({
        type: dto.type,
        brand: dto.brand,
        color: dto.color,
        densityGCm3: dto.densityGCm3,
        nozzleTempC: dto.nozzleTempC,
        bedTempC: dto.bedTempC,
        needsDrying: dto.needsDrying,
        ...drying,
        active: true,
      }),
    );
    return toMaterialResponse(created);
  }

  async update(id: string, dto: UpdateMaterialDto): Promise<MaterialResponse> {
    return this.materials.manager.transaction(async (manager) => {
      const repo = manager.getRepository(Material);
      const material = await repo.findOne({ where: { id } });
      if (!material) {
        throw new NotFoundException(MATERIAL_NOT_FOUND);
      }

      // Valida com o valor final de needsDrying/secagem, enviado ou já gravado (AC 16, mesmo
      // padrão do combined-rate de sales-channels).
      const finalNeedsDrying = dto.needsDrying ?? material.needsDrying;
      const finalDryingTemperatureC = dto.dryingTemperatureC ?? material.dryingTemperatureC ?? undefined;
      const finalDryingHours = dto.dryingHours ?? material.dryingHours ?? undefined;
      if (finalNeedsDrying) {
        const temperatureValid =
          finalDryingTemperatureC !== undefined && finalDryingTemperatureC >= 0 && finalDryingTemperatureC <= 120;
        const hoursValid = finalDryingHours !== undefined && finalDryingHours > 0;
        if (!temperatureValid || !hoursValid) {
          throw new BadRequestException(INVALID_DRYING_PARAMS);
        }
      }

      if (dto.type !== undefined) material.type = dto.type;
      if (dto.brand !== undefined) material.brand = dto.brand;
      if (dto.color !== undefined) material.color = dto.color;
      if (dto.densityGCm3 !== undefined) material.densityGCm3 = dto.densityGCm3;
      if (dto.nozzleTempC !== undefined) material.nozzleTempC = dto.nozzleTempC;
      if (dto.bedTempC !== undefined) material.bedTempC = dto.bedTempC;
      if (dto.active !== undefined) material.active = dto.active;
      material.needsDrying = finalNeedsDrying;
      // WHILE needsDrying for false, dryingTemperatureC/dryingHours ficam null (AC 5), mantido
      // também no PATCH.
      material.dryingTemperatureC = finalNeedsDrying ? (finalDryingTemperatureC ?? null) : null;
      material.dryingHours = finalNeedsDrying ? (finalDryingHours ?? null) : null;

      await repo.save(material);
      return toMaterialResponse(material);
    });
  }
}
