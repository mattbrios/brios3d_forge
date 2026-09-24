import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Supplier } from '../../suppliers/entities/supplier.entity.js';

export const STOCK_ITEM_CATEGORIES = ['insumo', 'peca_reposicao'] as const;
export type StockItemCategory = (typeof STOCK_ITEM_CATEGORIES)[number];

// Door 1: item controlado por quantidade, com saldo na própria unidade de medida. O saldo é uma
// coluna materializada escrita na mesma transação do movimento (AD-022), e o CHECK é o único
// backstop contra saldo negativo sob concorrência (AD-023).
@Entity('stock_items')
@Check('stock_item_balance_non_negative', '"balance_quantity" >= 0')
// Fase 11, door 1: mesmo shape do piso do material, na unidade do próprio item.
@Check('stock_items_minimum_non_negative', '"minimum_quantity" IS NULL OR "minimum_quantity" >= 0')
export class StockItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: STOCK_ITEM_CATEGORIES, enumName: 'stock_items_category_enum' })
  category: StockItemCategory;

  @Column()
  name: string;

  // Único quando informado; vários itens sem `sku` convivem, porque o índice único do Postgres
  // não trata dois NULL como duplicados (mesmo precedente de `Supplier.document`).
  @Column({ type: 'varchar', nullable: true, unique: true })
  sku: string | null;

  // Texto livre de exibição (`un`, `m`, `kg`, `L`, `folha`): o sistema nunca converte unidades.
  @Column({ name: 'unit_of_measure', type: 'varchar' })
  unitOfMeasure: string;

  @Column({ type: 'varchar', nullable: true })
  location: string | null;

  @Column({ name: 'preferred_supplier_id', type: 'uuid', nullable: true })
  preferredSupplierId: string | null;

  @ManyToOne(() => Supplier, { nullable: true })
  @JoinColumn({ name: 'preferred_supplier_id' })
  preferredSupplier: Supplier | null;

  @Column({ name: 'balance_quantity', type: 'double precision', default: 0 })
  balanceQuantity: number;

  // Fase 11, door 1: piso de reposição na unidade do item; `null` é "sem política", não zero.
  @Column({ name: 'minimum_quantity', type: 'double precision', nullable: true })
  minimumQuantity: number | null;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
