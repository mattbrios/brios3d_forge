import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Material } from '../../materials/entities/material.entity.js';
import { ProductVariant } from './product-variant.entity.js';

// Door 4: linha de material da ficha técnica. Some junto com a variação (CASCADE), mas nunca
// deixa apagar o material que ela usa (RESTRICT).
@Entity('product_variant_materials')
export class ProductVariantMaterial {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'variant_id', type: 'uuid' })
  variantId: string;

  @ManyToOne(() => ProductVariant, (variant) => variant.materials, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'variant_id' })
  variant: Relation<ProductVariant>;

  @Column({ name: 'material_id', type: 'uuid' })
  materialId: string;

  @ManyToOne(() => Material, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'material_id' })
  material: Material;

  @Column({ type: 'double precision' })
  grams: number;

  // Ordem em que as linhas foram enviadas, para a ficha voltar como foi montada.
  @Column({ type: 'integer' })
  position: number;
}
