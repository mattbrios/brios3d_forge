import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { Printer } from '../../printers/entities/printer.entity.js';
import { ProductVariantMaterial } from './product-variant-material.entity.js';
import { ProductVariantSupply } from './product-variant-supply.entity.js';
import { Product } from './product.entity.js';

@Entity('product_variants')
// Door 4: `UNIQUE (product_id, lower(name))` é um índice de expressão, criado só pela migration.
// `synchronize: false` impede o `migration:generate` de propor derrubá-lo.
@Index('product_variants_product_name_unique', { synchronize: false })
export class ProductVariant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, (product) => product.variants, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product: Relation<Product>;

  @Column()
  name: string;

  // Door 4: impressora de referência da ficha, FK RESTRICT e obrigatória.
  @Column({ name: 'printer_id', type: 'uuid' })
  printerId: string;

  @ManyToOne(() => Printer, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'printer_id' })
  printer: Printer;

  @Column({ name: 'print_hours', type: 'double precision' })
  printHours: number;

  @Column({ name: 'prep_hours', type: 'double precision' })
  prepHours: number;

  @Column({ name: 'slicing_hours', type: 'double precision' })
  slicingHours: number;

  @Column({ name: 'post_processing_hours', type: 'double precision' })
  postProcessingHours: number;

  @Column({ default: true })
  active: boolean;

  @OneToMany(() => ProductVariantMaterial, (line) => line.variant)
  materials: Relation<ProductVariantMaterial[]>;

  @OneToMany(() => ProductVariantSupply, (line) => line.variant)
  supplies: Relation<ProductVariantSupply[]>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
