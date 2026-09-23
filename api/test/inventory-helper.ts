import type { DataSource } from 'typeorm';
import type { MovementType } from '../src/modules/inventory/entities/inventory-movement.entity.js';

interface NewRoll {
  materialId: string;
  supplierId?: string | null;
  nominalWeightGrams?: number;
  initialWeightGrams?: number;
  balanceGrams?: number;
  spoolTareGrams?: number;
  batch?: string | null;
  purchaseDate?: string | null;
  openedAt?: Date | null;
  lastDriedAt?: Date | null;
  discardedAt?: Date | null;
  location?: string | null;
  acquisitionCostCents?: number;
}

// Grava o rolo direto no banco, sem passar pela rota, para preparar o estado de um teste.
export async function createRoll(dataSource: DataSource, roll: NewRoll): Promise<string> {
  const initialWeightGrams = roll.initialWeightGrams ?? 1000;
  const rows: Array<{ id: string }> = await dataSource.query(
    `INSERT INTO filament_rolls
       (material_id, supplier_id, nominal_weight_grams, initial_weight_grams, balance_grams,
        spool_tare_grams, batch, purchase_date, opened_at, last_dried_at, discarded_at,
        location, acquisition_cost_cents)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
    [
      roll.materialId,
      roll.supplierId ?? null,
      roll.nominalWeightGrams ?? initialWeightGrams,
      initialWeightGrams,
      roll.balanceGrams ?? initialWeightGrams,
      roll.spoolTareGrams ?? 250,
      roll.batch ?? null,
      roll.purchaseDate ?? null,
      roll.openedAt ?? null,
      roll.lastDriedAt ?? null,
      roll.discardedAt ?? null,
      roll.location ?? null,
      roll.acquisitionCostCents ?? 12000,
    ],
  );
  return rows[0].id;
}

interface NewMovement {
  rollId: string;
  type: MovementType;
  quantity: number;
  unitCostCents?: number | null;
  reason?: string | null;
  userId: string;
}

// Grava a movimentação de rolo direto no banco, sem passar pela rota, para preparar o estado de
// um teste. As colunas são as renomeadas da Fase 10 (door 4), com `stock_item_id` nulo (door 3).
export async function createMovement(dataSource: DataSource, movement: NewMovement): Promise<string> {
  const rows: Array<{ id: string }> = await dataSource.query(
    `INSERT INTO inventory_movements (roll_id, type, quantity, unit_cost_cents, reason, user_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      movement.rollId,
      movement.type,
      movement.quantity,
      movement.unitCostCents ?? null,
      movement.reason ?? null,
      movement.userId,
    ],
  );
  return rows[0].id;
}
