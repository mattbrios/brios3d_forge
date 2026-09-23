// Contrato de GET/POST/PATCH /suppliers (Fase 8).
export interface Supplier {
  id: string;
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  active: boolean;
}

export interface SuppliersPage {
  items: Supplier[];
  total: number;
  page: number;
  pageSize: number;
}
