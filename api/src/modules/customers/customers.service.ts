import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { ListCustomersDto } from './dto/list-customers.dto.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';
import { Customer } from './entities/customer.entity.js';
import { isUniqueViolation } from '../users/is-unique-violation.js';
import { digitsOfDocument, isValidDocument } from './is-valid-document.js';
import {
  CUSTOMER_NOT_FOUND,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  DUPLICATE_DOCUMENT,
  INVALID_DOCUMENT,
  type CustomerResponse,
  type ListCustomersResponse,
  toCustomerResponse,
} from './customers.types.js';

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
export class CustomersService {
  constructor(@InjectRepository(Customer) private readonly customers: Repository<Customer>) {}

  async list(query: ListCustomersDto): Promise<ListCustomersResponse> {
    const page = query.page ?? DEFAULT_PAGE;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

    const qb = this.customers
      .createQueryBuilder('customer')
      .orderBy('customer.name', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (query.search !== undefined) {
      qb.andWhere('customer.name ILIKE :search', { search: `%${escapeLike(query.search)}%` });
    }

    const [rows, total] = await qb.getManyAndCount();
    return { items: rows.map(toCustomerResponse), total, page, pageSize };
  }

  async create(dto: CreateCustomerDto): Promise<CustomerResponse> {
    const document = normalizedDocument(dto.document) ?? null;

    try {
      const created = await this.customers.save(
        this.customers.create({
          name: dto.name,
          document,
          phone: dto.phone ?? null,
          email: dto.email ?? null,
          address: dto.address ?? null,
          active: true,
        }),
      );
      return toCustomerResponse(created);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(DUPLICATE_DOCUMENT);
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateCustomerDto): Promise<CustomerResponse> {
    const document = normalizedDocument(dto.document);

    return this.customers.manager.transaction(async (manager) => {
      const repo = manager.getRepository(Customer);
      const customer = await repo.findOne({ where: { id } });
      if (!customer) {
        throw new NotFoundException(CUSTOMER_NOT_FOUND);
      }

      if (dto.name !== undefined) customer.name = dto.name;
      if (document !== undefined) customer.document = document;
      if (dto.phone !== undefined) customer.phone = dto.phone;
      if (dto.email !== undefined) customer.email = dto.email;
      if (dto.address !== undefined) customer.address = dto.address;
      if (dto.active !== undefined) customer.active = dto.active;

      try {
        await repo.save(customer);
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictException(DUPLICATE_DOCUMENT);
        }
        throw error;
      }
      return toCustomerResponse(customer);
    });
  }
}
