import { ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError, type Repository } from 'typeorm';
import type { InventoryService } from '../inventory/inventory.service.js';
import type { MaterialsService } from '../materials/materials.service.js';
import type { PrintersService } from '../printers/printers.service.js';
import { ProductVariantMaterial } from './entities/product-variant-material.entity.js';
import { ProductVariantSupply } from './entities/product-variant-supply.entity.js';
import { ProductVariant } from './entities/product-variant.entity.js';
import type { Product } from './entities/product.entity.js';
import { ProductsService } from './products.service.js';

const PRODUCT_ID = 'b0000000-0000-0000-0000-000000000001';
const VARIANT_ID = 'b0000000-0000-0000-0000-000000000002';
const MATERIAL_ID = 'b0000000-0000-0000-0000-000000000003';

function uniqueViolation(): QueryFailedError {
  return new QueryFailedError('INSERT', [], Object.assign(new Error('duplicate key'), { code: '23505' }));
}

// Os cadastros só confirmam existência; aqui todos existem.
const materials = { getById: async () => ({}) } as unknown as MaterialsService;
const printers = { getById: async () => ({}) } as unknown as PrintersService;
const inventory = { getItemById: async () => ({}) } as unknown as InventoryService;

describe('ProductsService', () => {
  describe('maps a unique violation on the model to 409 and rethrows anything else', () => {
    function serviceWhoseSaveThrows(error: unknown): ProductsService {
      const products = {
        create: (value: Partial<Product>) => value,
        save: async () => {
          throw error;
        },
        findOne: async () => ({ id: PRODUCT_ID, name: 'Estrela do mar' }),
      } as unknown as Repository<Product>;
      return new ProductsService(products, {} as Repository<ProductVariant>, materials, printers, inventory);
    }

    it('create: 23505 becomes ConflictException with the duplicate model message', async () => {
      const service = serviceWhoseSaveThrows(uniqueViolation());
      const result = service.create({ name: 'Estrela do mar', modelUrl: 'https://makerworld.com/models/3007827' });
      await expect(result).rejects.toBeInstanceOf(ConflictException);
      await expect(result).rejects.toThrow('Já existe um produto para este modelo');
    });

    it('update: 23505 becomes ConflictException with the duplicate model message', async () => {
      const service = serviceWhoseSaveThrows(uniqueViolation());
      const result = service.update(PRODUCT_ID, { modelUrl: 'https://makerworld.com/models/3007827' });
      await expect(result).rejects.toBeInstanceOf(ConflictException);
      await expect(result).rejects.toThrow('Já existe um produto para este modelo');
    });

    it('create and update rethrow any other error unchanged', async () => {
      const other = new Error('connection lost');
      const service = serviceWhoseSaveThrows(other);
      await expect(
        service.create({ name: 'Estrela do mar', modelUrl: 'https://makerworld.com/models/3007827' }),
      ).rejects.toBe(other);
      await expect(service.update(PRODUCT_ID, { name: 'Outro nome' })).rejects.toBe(other);
    });
  });

  describe('variant ownership and list replacement', () => {
    interface Calls {
      transactions: number;
      materialDeletes: unknown[];
      materialSaves: unknown[];
      supplyDeletes: unknown[];
      supplySaves: unknown[];
    }

    function build(storedProductId: string) {
      const calls: Calls = { transactions: 0, materialDeletes: [], materialSaves: [], supplyDeletes: [], supplySaves: [] };
      const stored = {
        id: VARIANT_ID,
        productId: storedProductId,
        name: 'Laranja',
        printerId: 'p',
        printHours: 1,
        prepHours: 0,
        slicingHours: 0,
        postProcessingHours: 0,
        active: true,
      };
      const txVariantRepo = { findOne: async () => ({ ...stored }), save: async (value: unknown) => value };
      const txMaterialRepo = {
        delete: async (criteria: unknown) => {
          calls.materialDeletes.push(criteria);
        },
        create: (value: unknown) => value,
        save: async (value: unknown) => {
          calls.materialSaves.push(value);
          return value;
        },
      };
      const txSupplyRepo = {
        delete: async (criteria: unknown) => {
          calls.supplyDeletes.push(criteria);
        },
        create: (value: unknown) => value,
        save: async (value: unknown) => {
          calls.supplySaves.push(value);
          return value;
        },
      };
      const manager = {
        getRepository: (entity: unknown) => {
          if (entity === ProductVariant) return txVariantRepo;
          if (entity === ProductVariantMaterial) return txMaterialRepo;
          if (entity === ProductVariantSupply) return txSupplyRepo;
          throw new Error('repositório inesperado');
        },
      };
      const variants = {
        manager: {
          transaction: async (work: (m: typeof manager) => Promise<unknown>) => {
            calls.transactions++;
            return work(manager);
          },
        },
        // Recarga depois do commit, com as relações que a resposta precisa.
        findOne: async () => ({
          ...stored,
          printer: { id: 'p', name: 'Impressora' },
          materials: [],
          supplies: [],
        }),
      } as unknown as Repository<ProductVariant>;
      const products = { exists: async () => true } as unknown as Repository<Product>;
      const service = new ProductsService(products, variants, materials, printers, inventory);
      return { service, calls };
    }

    it('a variant found under another product is NotFoundException("Variação não encontrada")', async () => {
      const { service } = build('outro-produto');
      const result = service.updateVariant(PRODUCT_ID, VARIANT_ID, { name: 'Azul' });
      await expect(result).rejects.toBeInstanceOf(NotFoundException);
      await expect(result).rejects.toThrow('Variação não encontrada');
    });

    it('materials undefined preserves the stored lines', async () => {
      const { service, calls } = build(PRODUCT_ID);
      await service.updateVariant(PRODUCT_ID, VARIANT_ID, { name: 'Azul' });
      expect(calls.materialDeletes).toEqual([]);
      expect(calls.materialSaves).toEqual([]);
      expect(calls.supplyDeletes).toEqual([]);
      expect(calls.supplySaves).toEqual([]);
    });

    it('materials [...] deletes and rewrites only the material lines, inside the transaction', async () => {
      const { service, calls } = build(PRODUCT_ID);
      await service.updateVariant(PRODUCT_ID, VARIANT_ID, { materials: [{ materialId: MATERIAL_ID, grams: 12 }] });
      expect(calls.transactions).toBe(1);
      expect(calls.materialDeletes).toEqual([{ variantId: VARIANT_ID }]);
      expect(calls.materialSaves).toEqual([[{ variantId: VARIANT_ID, materialId: MATERIAL_ID, grams: 12, position: 0 }]]);
      expect(calls.supplyDeletes).toEqual([]);
      expect(calls.supplySaves).toEqual([]);
    });
  });
});
