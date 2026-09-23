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
import { Material } from '../../materials/entities/material.entity.js';
import { Supplier } from '../../suppliers/entities/supplier.entity.js';

// Backstop de banco (door 3): sob duas baixas concorrentes, o CHECK rejeita quem estourar o
// saldo real, mesmo que as duas passem na validação da API.
@Entity('filament_rolls')
@Check('balance_non_negative', '"balance_grams" >= 0')
export class FilamentRoll {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'material_id', type: 'uuid' })
  materialId: string;

  @ManyToOne(() => Material)
  @JoinColumn({ name: 'material_id' })
  material: Material;

  @Column({ name: 'supplier_id', type: 'uuid', nullable: true })
  supplierId: string | null;

  @ManyToOne(() => Supplier, { nullable: true })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier | null;

  @Column({ name: 'nominal_weight_grams', type: 'double precision' })
  nominalWeightGrams: number;

  @Column({ name: 'initial_weight_grams', type: 'double precision' })
  initialWeightGrams: number;

  // Coluna materializada (door 2 do plano): sempre escrita dentro da mesma transação da
  // InventoryMovement correspondente; o ledger continua sendo a fonte da verdade.
  @Column({ name: 'balance_grams', type: 'double precision' })
  balanceGrams: number;

  @Column({ name: 'spool_tare_grams', type: 'double precision' })
  spoolTareGrams: number;

  @Column({ type: 'varchar', nullable: true })
  batch: string | null;

  @Column({ name: 'purchase_date', type: 'date', nullable: true })
  purchaseDate: string | null;

  @Column({ name: 'opened_at', type: 'timestamptz', nullable: true })
  openedAt: Date | null;

  @Column({ name: 'last_dried_at', type: 'timestamptz', nullable: true })
  lastDriedAt: Date | null;

  @Column({ name: 'discarded_at', type: 'timestamptz', nullable: true })
  discardedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  location: string | null;

  @Column({ name: 'acquisition_cost_cents', type: 'double precision' })
  acquisitionCostCents: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
