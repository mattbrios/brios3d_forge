import type { DataSource } from 'typeorm';

interface NewCustomer {
  name: string;
  document?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  active?: boolean;
}

// Grava o cliente direto no banco, sem passar pela rota, para preparar o estado de um teste.
export async function createCustomer(dataSource: DataSource, customer: NewCustomer): Promise<string> {
  const rows: Array<{ id: string }> = await dataSource.query(
    `INSERT INTO customers (name, document, phone, email, address, active)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      customer.name,
      customer.document ?? null,
      customer.phone ?? null,
      customer.email ?? null,
      customer.address ?? null,
      customer.active ?? true,
    ],
  );
  return rows[0].id;
}
