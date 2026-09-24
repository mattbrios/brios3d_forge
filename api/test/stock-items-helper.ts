import type { DataSource } from 'typeorm';
import type { MovementType } from '../src/modules/inventory/entities/inventory-movement.entity.js';
import type { StockItemCategory } from '../src/modules/inventory/entities/stock-item.entity.js';

interface NewStockItem {
  category?: StockItemCategory;
  name?: string;
  sku?: string | null;
  unitOfMeasure?: string;
  location?: string | null;
  preferredSupplierId?: string | null;
  balanceQuantity?: number;
  active?: boolean;
  minimumQuantity?: number | null;
}

// Grava o item direto no banco, sem passar pela rota, para preparar o estado de um teste.
export async function createStockItem(dataSource: DataSource, item: NewStockItem = {}): Promise<string> {
  const rows: Array<{ id: string }> = await dataSource.query(
    `INSERT INTO stock_items
       (category, name, sku, unit_of_measure, location, preferred_supplier_id, balance_quantity, active, minimum_quantity)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      item.category ?? 'insumo',
      item.name ?? 'Parafuso M3x8',
      item.sku ?? null,
      item.unitOfMeasure ?? 'un',
      item.location ?? null,
      item.preferredSupplierId ?? null,
      item.balanceQuantity ?? 0,
      item.active ?? true,
      item.minimumQuantity ?? null,
    ],
  );
  return rows[0].id;
}

interface NewItemMovement {
  stockItemId: string;
  type: MovementType;
  quantity: number;
  unitCostCents?: number | null;
  reason?: string | null;
  userId: string;
}

// Movimento com dono item (door 3): `roll_id` fica nulo e `stock_item_id` preenchido.
export async function createItemMovement(
  dataSource: DataSource,
  movement: NewItemMovement,
): Promise<string> {
  const rows: Array<{ id: string }> = await dataSource.query(
    `INSERT INTO inventory_movements (stock_item_id, type, quantity, unit_cost_cents, reason, user_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      movement.stockItemId,
      movement.type,
      movement.quantity,
      movement.unitCostCents ?? null,
      movement.reason ?? null,
      movement.userId,
    ],
  );
  return rows[0].id;
}

// Vínculo de compatibilidade peça×impressora (door 2), direto na tabela de junção.
export async function linkPrinter(
  dataSource: DataSource,
  stockItemId: string,
  printerId: string,
): Promise<void> {
  await dataSource.query(
    'INSERT INTO stock_item_printers (stock_item_id, printer_id) VALUES ($1, $2)',
    [stockItemId, printerId],
  );
}

export async function userIdOf(dataSource: DataSource, email: string): Promise<string> {
  const rows: Array<{ id: string }> = await dataSource.query('SELECT id FROM users WHERE email = $1', [
    email,
  ]);
  return rows[0].id;
}
