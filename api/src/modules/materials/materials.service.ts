import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateMaterialDto } from './dto/create-material.dto.js';
import { ListMaterialsDto } from './dto/list-materials.dto.js';
import { UpdateMaterialDto } from './dto/update-material.dto.js';
import { Material } from './entities/material.entity.js';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
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

  // Consumido pela Fase 12 (quote-preview) para validar o materialId recebido no corpo.
  async getById(id: string): Promise<MaterialResponse> {
    const material = await this.materials.findOne({ where: { id } });
    if (!material) {
      throw new NotFoundException(MATERIAL_NOT_FOUND);
    }
    return toMaterialResponse(material);
  }

  async create(dto: CreateMaterialDto): Promise<MaterialResponse> {
    const created = await this.materials.save(
      this.materials.create({
        type: dto.type,
        brand: dto.brand,
        color: dto.color,
        densityGCm3: dto.densityGCm3,
        nozzleTempC: dto.nozzleTempC,
        bedTempC: dto.bedTempC,
        active: true,
        minimumStockGrams: dto.minimumStockGrams ?? null,
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

      if (dto.type !== undefined) material.type = dto.type;
      if (dto.brand !== undefined) material.brand = dto.brand;
      if (dto.color !== undefined) material.color = dto.color;
      if (dto.densityGCm3 !== undefined) material.densityGCm3 = dto.densityGCm3;
      if (dto.nozzleTempC !== undefined) material.nozzleTempC = dto.nozzleTempC;
      if (dto.bedTempC !== undefined) material.bedTempC = dto.bedTempC;
      if (dto.active !== undefined) material.active = dto.active;
      // Fase 11, door 1: `undefined` preserva o piso, `null` explícito limpa a política.
      if (dto.minimumStockGrams !== undefined) material.minimumStockGrams = dto.minimumStockGrams;

      await repo.save(material);
      return toMaterialResponse(material);
    });
  }
}
