import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export interface Nozzle {
  diameterMm: number;
  type: string;
}

@Entity('printers')
export class Printer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ name: 'acquisition_cost_cents', type: 'double precision' })
  acquisitionCostCents: number;

  @Column({ name: 'lifespan_hours', type: 'double precision' })
  lifespanHours: number;

  @Column({ name: 'power_watts', type: 'double precision' })
  powerWatts: number;

  @Column({ name: 'hourmeter_hours', type: 'double precision', default: 0 })
  hourmeterHours: number;

  @Column({ type: 'jsonb' })
  nozzles: Nozzle[];

  @Column({ name: 'has_ams' })
  hasAms: boolean;

  // null quando hasAms é false (AC 7, invariante mantido também no PATCH).
  @Column({ name: 'ams_slots', type: 'integer', nullable: true })
  amsSlots: number | null;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
