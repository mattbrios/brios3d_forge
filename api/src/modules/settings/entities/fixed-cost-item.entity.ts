import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Sem CRUD dedicado (door 2): a lista inteira é substituída por PATCH /settings.
// `settingsId` é uma FK simples (criada via SQL bruto na migration); sem relação de objeto
// TypeORM de propósito - `settings` e `fixed_cost_items` fariam um import circular entre
// entidades (Settings ⇄ FixedCostItem), que quebra em runtime ESM por causa das
// `design:type` do `emitDecoratorMetadata`.
@Entity('fixed_cost_items')
export class FixedCostItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'settings_id', type: 'uuid' })
  settingsId: string;

  @Column({ length: 60 })
  name: string;

  @Column({ name: 'monthly_cents', type: 'double precision' })
  monthlyCents: number;
}
