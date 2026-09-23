import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateSupplierDto } from './dto/create-supplier.dto.js';
import { ListSuppliersDto } from './dto/list-suppliers.dto.js';
import { UpdateSupplierDto } from './dto/update-supplier.dto.js';
import { Supplier } from './entities/supplier.entity.js';
import { isUniqueViolation } from '../users/is-unique-violation.js';
import { digitsOfDocument, isValidDocument } from '../customers/is-valid-document.js';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  DUPLICATE_DOCUMENT,
  INVALID_DOCUMENT,
  SUPPLIER_NOT_FOUND,
  type ListSuppliersResponse,
  type SupplierResponse,
  toSupplierResponse,
} from './suppliers.types.js';

// Escapa os curingas do ILIKE para o texto do usuário virar uma substring literal.
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

// undefined mantém o campo como está (PATCH); null grava explicitamente ausente.
function normalizedDocument(document: string | undefined): string | null | undefined {
  if (document === undefined) {
    return undefined;
  }
  if (!isValidDocument(document)) {
    throw new BadRequestException(INVALID_DOCUMENT);
  }
  return digitsOfDocument(document);
}

@Injectable()
export class SuppliersService {
  constructor(@InjectRepository(Supplier) private readonly suppliers: Repository<Supplier>) {}

  async list(query: ListSuppliersDto): Promise<ListSuppliersResponse> {
    const page = query.page ?? DEFAULT_PAGE;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

    const qb = this.suppliers
      .createQueryBuilder('supplier')
      .orderBy('supplier.name', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (query.search !== undefined) {
      qb.andWhere('supplier.name ILIKE :search', { search: `%${escapeLike(query.search)}%` });
    }

    const [rows, total] = await qb.getManyAndCount();
    return { items: rows.map(toSupplierResponse), total, page, pageSize };
  }

  async create(dto: CreateSupplierDto): Promise<SupplierResponse> {
    const document = normalizedDocument(dto.document) ?? null;

    try {
      const created = await this.suppliers.save(
        this.suppliers.create({
          name: dto.name,
          document,
          phone: dto.phone ?? null,
          email: dto.email ?? null,
          address: dto.address ?? null,
          active: true,
        }),
      );
      return toSupplierResponse(created);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(DUPLICATE_DOCUMENT);
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateSupplierDto): Promise<SupplierResponse> {
    const document = normalizedDocument(dto.document);

    return this.suppliers.manager.transaction(async (manager) => {
      const repo = manager.getRepository(Supplier);
      const supplier = await repo.findOne({ where: { id } });
      if (!supplier) {
        throw new NotFoundException(SUPPLIER_NOT_FOUND);
      }

      if (dto.name !== undefined) supplier.name = dto.name;
      if (document !== undefined) supplier.document = document;
      if (dto.phone !== undefined) supplier.phone = dto.phone;
      if (dto.email !== undefined) supplier.email = dto.email;
      if (dto.address !== undefined) supplier.address = dto.address;
      if (dto.active !== undefined) supplier.active = dto.active;

      try {
        await repo.save(supplier);
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictException(DUPLICATE_DOCUMENT);
        }
        throw error;
      }
      return toSupplierResponse(supplier);
    });
  }
}
