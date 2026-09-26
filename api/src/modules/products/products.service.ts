import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryService } from '../inventory/inventory.service.js';
import { MaterialsService } from '../materials/materials.service.js';
import { materialNotFound, printerNotFound, stockItemNotFound } from '../pricing/quote-preview.types.js';
import { PrintersService } from '../printers/printers.service.js';
import { isUniqueViolation } from '../users/is-unique-violation.js';
import { CreateProductVariantDto, VariantMaterialDto, VariantSupplyDto } from './dto/create-product-variant.dto.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { ListProductsDto } from './dto/list-products.dto.js';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ProductVariantMaterial } from './entities/product-variant-material.entity.js';
import { ProductVariantSupply } from './entities/product-variant-supply.entity.js';
import { ProductVariant } from './entities/product-variant.entity.js';
import { Product } from './entities/product.entity.js';
import { canonicalModelUrl, parseModelUrl } from './model-url.js';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  DUPLICATE_MODEL,
  DUPLICATE_VARIANT_NAME,
  type ListProductsResponse,
  PRODUCT_NOT_FOUND,
  type ProductResponse,
  type ProductVariantResponse,
  toProductSummary,
  toVariantResponse,
  VARIANT_NOT_FOUND,
} from './products.types.js';

// Escapa os curingas do ILIKE para o texto do usuário virar uma substring literal.
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

const VARIANT_RELATIONS = {
  printer: true,
  materials: { material: true },
  supplies: { stockItem: true },
} as const;

function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name, 'pt-BR');
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(ProductVariant) private readonly variants: Repository<ProductVariant>,
    private readonly materials: MaterialsService,
    private readonly printers: PrintersService,
    private readonly inventory: InventoryService,
  ) {}

  async list(query: ListProductsDto): Promise<ListProductsResponse> {
    const page = query.page ?? DEFAULT_PAGE;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const qb = this.products
      .createQueryBuilder('product')
      .orderBy('product.name', 'ASC')
      .addOrderBy('product.id', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);
    if (query.search !== undefined) {
      qb.andWhere('(product.name ILIKE :search OR product.model_title ILIKE :search)', {
        search: `%${escapeLike(query.search)}%`,
      });
    }
    if (query.platform !== undefined) {
      qb.andWhere('product.model_platform = :platform', { platform: query.platform });
    }
    const [rows, total] = await qb.getManyAndCount();
    return { items: rows.map(toProductSummary), total, page, pageSize };
  }

  async getById(id: string): Promise<ProductResponse> {
    const product = await this.products.findOne({ where: { id }, relations: { variants: VARIANT_RELATIONS } });
    if (!product) {
      throw new NotFoundException(PRODUCT_NOT_FOUND);
    }
    return {
      ...toProductSummary(product),
      variants: [...product.variants].sort(byName).map(toVariantResponse),
    };
  }

  async create(dto: CreateProductDto): Promise<ProductResponse> {
    const identity = parseModelUrl(dto.modelUrl);
    let created: Product;
    try {
      created = await this.products.save(
        this.products.create({
          name: dto.name,
          description: dto.description ?? null,
          modelUrl: canonicalModelUrl(identity),
          modelPlatform: identity.platform,
          modelExternalId: identity.externalId,
          modelTitle: dto.modelTitle ?? null,
          modelImageUrl: dto.modelImageUrl ?? null,
          modelDesigner: dto.modelDesigner ?? null,
          modelLicense: dto.modelLicense ?? null,
          commercialUseAllowed: dto.commercialUseAllowed ?? null,
          modelMetadataFetchedAt: null,
          active: true,
        }),
      );
    } catch (error) {
      throw conflictOr(error, DUPLICATE_MODEL);
    }
    return { ...toProductSummary(created), variants: [] };
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductResponse> {
    const product = await this.products.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(PRODUCT_NOT_FOUND);
    }
    if (dto.modelUrl !== undefined) {
      const identity = parseModelUrl(dto.modelUrl);
      product.modelPlatform = identity.platform;
      product.modelExternalId = identity.externalId;
      product.modelUrl = canonicalModelUrl(identity);
    }
    if (dto.name !== undefined) product.name = dto.name;
    if (dto.description !== undefined) product.description = dto.description;
    if (dto.modelTitle !== undefined) product.modelTitle = dto.modelTitle;
    if (dto.modelImageUrl !== undefined) product.modelImageUrl = dto.modelImageUrl;
    if (dto.modelDesigner !== undefined) product.modelDesigner = dto.modelDesigner;
    if (dto.modelLicense !== undefined) product.modelLicense = dto.modelLicense;
    if (dto.commercialUseAllowed !== undefined) product.commercialUseAllowed = dto.commercialUseAllowed;
    if (dto.active !== undefined) product.active = dto.active;
    try {
      await this.products.save(product);
    } catch (error) {
      throw conflictOr(error, DUPLICATE_MODEL);
    }
    return this.getById(id);
  }

  async createVariant(productId: string, dto: CreateProductVariantDto): Promise<ProductVariantResponse> {
    await this.assertProductExists(productId);
    const supplies = dto.supplies ?? [];
    await this.assertReferences(dto.printerId, dto.materials, supplies);
    let variantId: string;
    try {
      variantId = await this.variants.manager.transaction(async (manager) => {
        const variant = await manager.getRepository(ProductVariant).save(
          manager.getRepository(ProductVariant).create({
            productId,
            name: dto.name,
            printerId: dto.printerId,
            printHours: dto.printHours,
            prepHours: dto.prepHours,
            slicingHours: dto.slicingHours,
            postProcessingHours: dto.postProcessingHours,
            active: true,
          }),
        );
        await this.writeMaterials(manager.getRepository(ProductVariantMaterial), variant.id, dto.materials);
        await this.writeSupplies(manager.getRepository(ProductVariantSupply), variant.id, supplies);
        return variant.id;
      });
    } catch (error) {
      throw conflictOr(error, DUPLICATE_VARIANT_NAME);
    }
    return this.loadVariant(variantId);
  }

  async updateVariant(
    productId: string,
    variantId: string,
    dto: UpdateProductVariantDto,
  ): Promise<ProductVariantResponse> {
    await this.assertProductExists(productId);
    try {
      await this.variants.manager.transaction(async (manager) => {
        const variantRepo = manager.getRepository(ProductVariant);
        const variant = await variantRepo.findOne({ where: { id: variantId } });
        // AC 18: uma variação de outro produto é tratada como inexistente.
        if (!variant || variant.productId !== productId) {
          throw new NotFoundException(VARIANT_NOT_FOUND);
        }
        await this.assertReferences(dto.printerId, dto.materials ?? [], dto.supplies ?? []);
        if (dto.name !== undefined) variant.name = dto.name;
        if (dto.printerId !== undefined) variant.printerId = dto.printerId;
        if (dto.printHours !== undefined) variant.printHours = dto.printHours;
        if (dto.prepHours !== undefined) variant.prepHours = dto.prepHours;
        if (dto.slicingHours !== undefined) variant.slicingHours = dto.slicingHours;
        if (dto.postProcessingHours !== undefined) variant.postProcessingHours = dto.postProcessingHours;
        if (dto.active !== undefined) variant.active = dto.active;
        await variantRepo.save(variant);
        // AC 17: a lista enviada substitui a gravada inteira; a omitida fica como está.
        if (dto.materials !== undefined) {
          const repo = manager.getRepository(ProductVariantMaterial);
          await repo.delete({ variantId });
          await this.writeMaterials(repo, variantId, dto.materials);
        }
        if (dto.supplies !== undefined) {
          const repo = manager.getRepository(ProductVariantSupply);
          await repo.delete({ variantId });
          await this.writeSupplies(repo, variantId, dto.supplies);
        }
      });
    } catch (error) {
      throw conflictOr(error, DUPLICATE_VARIANT_NAME);
    }
    return this.loadVariant(variantId);
  }

  private async assertProductExists(productId: string): Promise<void> {
    const exists = await this.products.exists({ where: { id: productId } });
    if (!exists) {
      throw new NotFoundException(PRODUCT_NOT_FOUND);
    }
  }

  // AC 15: só a existência é conferida (Assumption: cadastro inativo é aceito na ficha).
  private async assertReferences(
    printerId: string | undefined,
    materials: VariantMaterialDto[],
    supplies: VariantSupplyDto[],
  ): Promise<void> {
    if (printerId !== undefined) {
      await this.printers.getById(printerId).catch(renameNotFound(printerNotFound(printerId)));
    }
    for (const line of materials) {
      await this.materials.getById(line.materialId).catch(renameNotFound(materialNotFound(line.materialId)));
    }
    for (const line of supplies) {
      await this.inventory
        .getItemById(line.stockItemId)
        .catch(renameNotFound(stockItemNotFound(line.stockItemId)));
    }
  }

  private async writeMaterials(
    repo: Repository<ProductVariantMaterial>,
    variantId: string,
    lines: VariantMaterialDto[],
  ): Promise<void> {
    if (lines.length === 0) return;
    await repo.save(
      lines.map((line, position) =>
        repo.create({ variantId, materialId: line.materialId, grams: line.grams, position }),
      ),
    );
  }

  private async writeSupplies(
    repo: Repository<ProductVariantSupply>,
    variantId: string,
    lines: VariantSupplyDto[],
  ): Promise<void> {
    if (lines.length === 0) return;
    await repo.save(
      lines.map((line, position) =>
        repo.create({ variantId, stockItemId: line.stockItemId, quantity: line.quantity, position }),
      ),
    );
  }

  private async loadVariant(variantId: string): Promise<ProductVariantResponse> {
    const variant = await this.variants.findOne({ where: { id: variantId }, relations: VARIANT_RELATIONS });
    if (!variant) {
      throw new NotFoundException(VARIANT_NOT_FOUND);
    }
    return toVariantResponse(variant);
  }
}

// Door 3 e door 4: o índice único é o mecanismo do 409; qualquer outro erro sobe sem alteração.
function conflictOr(error: unknown, message: string): unknown {
  return isUniqueViolation(error) ? new ConflictException(message) : error;
}

function renameNotFound(message: string) {
  return (error: unknown): never => {
    if (error instanceof NotFoundException) {
      throw new NotFoundException(message);
    }
    throw error;
  };
}
