import type { DataSource } from 'typeorm';

interface NewProduct {
  name?: string;
  modelPlatform?: 'printables' | 'makerworld' | 'thingiverse';
  modelExternalId: string;
  modelUrl?: string;
  modelTitle?: string | null;
  commercialUseAllowed?: boolean | null;
  active?: boolean;
}

// Grava o produto direto no banco, sem passar pela rota, para preparar o estado de um teste.
export async function createProduct(dataSource: DataSource, product: NewProduct): Promise<string> {
  const platform = product.modelPlatform ?? 'makerworld';
  const rows: Array<{ id: string }> = await dataSource.query(
    `INSERT INTO products (name, model_url, model_platform, model_external_id, model_title, commercial_use_allowed, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      product.name ?? 'Produto de teste',
      product.modelUrl ?? `https://makerworld.com/models/${product.modelExternalId}`,
      platform,
      product.modelExternalId,
      product.modelTitle ?? null,
      product.commercialUseAllowed ?? null,
      product.active ?? true,
    ],
  );
  return rows[0].id;
}

interface NewVariant {
  productId: string;
  printerId: string;
  name?: string;
  printHours?: number;
  prepHours?: number;
  slicingHours?: number;
  postProcessingHours?: number;
  active?: boolean;
  materials?: Array<{ materialId: string; grams: number }>;
  supplies?: Array<{ stockItemId: string; quantity: number }>;
}

// Grava a variação e as linhas da ficha direto no banco.
export async function createVariant(dataSource: DataSource, variant: NewVariant): Promise<string> {
  const rows: Array<{ id: string }> = await dataSource.query(
    `INSERT INTO product_variants
       (product_id, name, printer_id, print_hours, prep_hours, slicing_hours, post_processing_hours, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      variant.productId,
      variant.name ?? 'Variação de teste',
      variant.printerId,
      variant.printHours ?? 1,
      variant.prepHours ?? 0,
      variant.slicingHours ?? 0,
      variant.postProcessingHours ?? 0,
      variant.active ?? true,
    ],
  );
  const variantId = rows[0].id;
  for (const [position, line] of (variant.materials ?? []).entries()) {
    await dataSource.query(
      'INSERT INTO product_variant_materials (variant_id, material_id, grams, position) VALUES ($1, $2, $3, $4)',
      [variantId, line.materialId, line.grams, position],
    );
  }
  for (const [position, line] of (variant.supplies ?? []).entries()) {
    await dataSource.query(
      'INSERT INTO product_variant_supplies (variant_id, stock_item_id, quantity, position) VALUES ($1, $2, $3, $4)',
      [variantId, line.stockItemId, line.quantity, position],
    );
  }
  return variantId;
}

// As FKs RESTRICT obrigam a ordem: fichas e produtos antes dos cadastros que elas usam.
export async function deleteProducts(dataSource: DataSource): Promise<void> {
  await dataSource.query('DELETE FROM product_variant_materials');
  await dataSource.query('DELETE FROM product_variant_supplies');
  await dataSource.query('DELETE FROM product_variants');
  await dataSource.query('DELETE FROM products');
}
