import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { StockItem } from '../../inventory/entities/stock-item.entity.js';
import { ProductVariant } from './product-variant.entity.js';

// Door 4: linha de insumo da ficha técnica, com as mesmas regras de FK da linha de material.
@Entity('product_variant_supplies')
export class ProductVariantSupply {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'variant_id', type: 'uuid' })
  variantId: string;

  @ManyToOne(() => ProductVariant, (variant) => variant.supplies, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'variant_id' })
  variant: Relation<ProductVariant>;

  @Column({ name: 'stock_item_id', type: 'uuid' })
  stockItemId: string;

  @ManyToOne(() => StockItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'stock_item_id' })
  stockItem: StockItem;

  @Column({ type: 'double precision' })
  quantity: number;

  @Column({ type: 'integer' })
  position: number;
}
