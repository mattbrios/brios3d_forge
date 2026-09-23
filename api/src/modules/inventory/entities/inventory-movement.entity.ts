import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { FilamentRoll } from './filament-roll.entity.js';

// Ledger imutável (door 1): nenhuma rota de edição/exclusão é declarada no controller.
export const MOVEMENT_TYPES = ['entrada', 'consumo', 'perda', 'ajuste'] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

@Entity('inventory_movements')
export class InventoryMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'roll_id', type: 'uuid' })
  rollId: string;

  @ManyToOne(() => FilamentRoll)
  @JoinColumn({ name: 'roll_id' })
  roll: FilamentRoll;

  @Column({ type: 'enum', enum: MOVEMENT_TYPES, enumName: 'inventory_movements_type_enum' })
  type: MovementType;

  // Assinado: positivo em entrada/ajuste que aumenta o saldo, negativo em consumo/perda/ajuste
  // que reduz o saldo.
  @Column({ name: 'quantity_grams', type: 'double precision' })
  quantityGrams: number;

  // null em consumo/perda/ajuste, que não carregam custo próprio.
  @Column({ name: 'unit_cost_cents_per_gram', type: 'double precision', nullable: true })
  unitCostCentsPerGram: number | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
