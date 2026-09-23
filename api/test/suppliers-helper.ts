import type { DataSource } from 'typeorm';

interface NewSupplier {
  name: string;
  document?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  active?: boolean;
}

// Grava o fornecedor direto no banco, sem passar pela rota, para preparar o estado de um teste.
export async function createSupplier(dataSource: DataSource, supplier: NewSupplier): Promise<string> {
  const rows: Array<{ id: string }> = await dataSource.query(
    `INSERT INTO suppliers (name, document, phone, email, address, active)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      supplier.name,
      supplier.document ?? null,
      supplier.phone ?? null,
      supplier.email ?? null,
      supplier.address ?? null,
      supplier.active ?? true,
    ],
  );
  return rows[0].id;
}
