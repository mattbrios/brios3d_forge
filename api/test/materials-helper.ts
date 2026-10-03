import type { DataSource } from 'typeorm';

interface NewMaterial {
  type: string;
  brand?: string;
  color?: string;
  densityGCm3?: number;
  nozzleTempC?: number;
  bedTempC?: number;
  active?: boolean;
  minimumStockGrams?: number | null;
}

// Grava o material direto no banco, sem passar pela rota, para preparar o estado de um teste.
export async function createMaterial(dataSource: DataSource, material: NewMaterial): Promise<string> {
  const rows: Array<{ id: string }> = await dataSource.query(
    `INSERT INTO materials
       (type, brand, color, density_g_cm3, nozzle_temp_c, bed_temp_c, active, minimum_stock_grams)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      material.type,
      material.brand ?? 'Marca de teste',
      material.color ?? 'Natural',
      material.densityGCm3 ?? 1.24,
      material.nozzleTempC ?? 200,
      material.bedTempC ?? 60,
      material.active ?? true,
      material.minimumStockGrams ?? null,
    ],
  );
  return rows[0].id;
}
