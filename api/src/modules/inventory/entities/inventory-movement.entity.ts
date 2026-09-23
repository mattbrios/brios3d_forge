import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { FilamentRoll } from './filament-roll.entity.js';
import { StockItem } from './stock-item.entity.js';

// Ledger imutável (Fase 9, door 1): nenhuma rota de edição/exclusão é declarada no controller.
export const MOVEMENT_TYPES = ['entrada', 'consumo', 'perda', 'ajuste'] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

// Dono único (Fase 10, door 3): todo movimento aponta para um rolo OU para um item de estoque,
// nunca para os dois e nunca para nenhum. O XOR fica no banco porque a lista unificada
// (GET /inventory/movements) lê as duas colunas e o web escolhe a linha pelo dono preenchido.
@Entity('inventory_movements')
@Check('movement_single_owner', '("roll_id" IS NOT NULL) <> ("stock_item_id" IS NOT NULL)')
export class InventoryMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'roll_id', type: 'uuid', nullable: true })
  rollId: string | null;

  @ManyToOne(() => FilamentRoll, { nullable: true })
  @JoinColumn({ name: 'roll_id' })
  roll: FilamentRoll | null;

  @Column({ name: 'stock_item_id', type: 'uuid', nullable: true })
  stockItemId: string | null;

  @ManyToOne(() => StockItem, { nullable: true })
  @JoinColumn({ name: 'stock_item_id' })
  stockItem: StockItem | null;

  @Column({ type: 'enum', enum: MOVEMENT_TYPES, enumName: 'inventory_movements_type_enum' })
  type: MovementType;

  // Assinado: positivo em entrada/ajuste que aumenta o saldo, negativo em consumo/perda/ajuste
  // que reduz o saldo. A unidade vem do dono: grama no rolo, `unitOfMeasure` no item (door 4).
  @Column({ name: 'quantity', type: 'double precision' })
  quantity: number;

  // null em consumo/perda/ajuste, que não carregam custo próprio. Por grama no rolo, por
  // unidade de medida no item (door 4).
  @Column({ name: 'unit_cost_cents', type: 'double precision', nullable: true })
  unitCostCents: number | null;

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
