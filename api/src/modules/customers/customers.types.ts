import type { Customer } from './entities/customer.entity.js';

// Contrato de GET/POST/PATCH /customers.
export interface CustomerResponse {
  id: string;
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  active: boolean;
}

export interface ListCustomersResponse {
  items: CustomerResponse[];
  total: number;
  page: number;
  pageSize: number;
}

export function toCustomerResponse(customer: Customer): CustomerResponse {
  return {
    id: customer.id,
    name: customer.name,
    document: customer.document,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
    active: customer.active,
  };
}

export const CUSTOMER_NOT_FOUND = 'Cliente não encontrado';
export const INVALID_DOCUMENT = 'document inválido: informe um CPF ou CNPJ com dígito verificador correto';
export const DUPLICATE_DOCUMENT = 'Já existe um cliente com este document';

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
