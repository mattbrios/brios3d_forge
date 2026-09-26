import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator.js';
import { CreateProductVariantDto } from './dto/create-product-variant.dto.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { ListProductsDto } from './dto/list-products.dto.js';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ProductPricingService } from './product-pricing.service.js';
import { ProductsService } from './products.service.js';
import type {
  ListProductsResponse,
  ProductPricingResponse,
  ProductResponse,
  ProductVariantResponse,
} from './products.types.js';

const uuid = new ParseUUIDPipe({ errorHttpStatusCode: 400 });

// Leitura, custo e preço para os três papéis; escrita só de admin (rotas sem @Roles(), AD-018).
// Nenhuma rota DELETE: produto e variação só se desativam (door 4).
@Controller('products')
export class ProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly productPricing: ProductPricingService,
  ) {}

  @Roles('production', 'sales')
  @Get()
  list(@Query() query: ListProductsDto): Promise<ListProductsResponse> {
    return this.products.list(query);
  }

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateProductDto): Promise<ProductResponse> {
    return this.products.create(dto);
  }

  @Roles('production', 'sales')
  @Get(':id')
  getById(@Param('id', uuid) id: string): Promise<ProductResponse> {
    return this.products.getById(id);
  }

  @Patch(':id')
  update(@Param('id', uuid) id: string, @Body() dto: UpdateProductDto): Promise<ProductResponse> {
    return this.products.update(id, dto);
  }

  @Roles('production', 'sales')
  @Get(':id/pricing')
  pricing(@Param('id', uuid) id: string): Promise<ProductPricingResponse> {
    return this.productPricing.pricing(id);
  }

  @Post(':id/variants')
  @HttpCode(201)
  createVariant(
    @Param('id', uuid) id: string,
    @Body() dto: CreateProductVariantDto,
  ): Promise<ProductVariantResponse> {
    return this.products.createVariant(id, dto);
  }

  @Patch(':id/variants/:variantId')
  updateVariant(
    @Param('id', uuid) id: string,
    @Param('variantId', uuid) variantId: string,
    @Body() dto: UpdateProductVariantDto,
  ): Promise<ProductVariantResponse> {
    return this.products.updateVariant(id, variantId, dto);
  }
}
