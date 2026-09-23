import type { Supplier } from './entities/supplier.entity.js';

// Contrato de GET/POST/PATCH /suppliers.
export interface SupplierResponse {
  id: string;
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  active: boolean;
}

export interface ListSuppliersResponse {
  items: SupplierResponse[];
  total: number;
  page: number;
  pageSize: number;
}

export function toSupplierResponse(supplier: Supplier): SupplierResponse {
  return {
    id: supplier.id,
    name: supplier.name,
    document: supplier.document,
    phone: supplier.phone,
    email: supplier.email,
    address: supplier.address,
    active: supplier.active,
  };
}

export const SUPPLIER_NOT_FOUND = 'Fornecedor não encontrado';
export const INVALID_DOCUMENT = 'document inválido: informe um CPF ou CNPJ com dígito verificador correto';
export const DUPLICATE_DOCUMENT = 'Já existe um fornecedor com este document';

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
