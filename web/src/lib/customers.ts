// Contrato de GET/POST/PATCH /customers (Fase 8).
export interface Customer {
  id: string;
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  active: boolean;
}

export interface CustomersPage {
  items: Customer[];
  total: number;
  page: number;
  pageSize: number;
}
