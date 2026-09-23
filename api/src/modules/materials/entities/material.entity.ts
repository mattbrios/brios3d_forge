import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('materials')
export class Material {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Texto livre (Assumption do plano): a lista do ROADMAP termina em reticências.
  @Column()
  type: string;

  @Column()
  brand: string;

  @Column()
  color: string;

  @Column({ name: 'density_g_cm3', type: 'double precision' })
  densityGCm3: number;

  @Column({ name: 'nozzle_temp_c', type: 'double precision' })
  nozzleTempC: number;

  @Column({ name: 'bed_temp_c', type: 'double precision' })
  bedTempC: number;

  @Column({ name: 'needs_drying' })
  needsDrying: boolean;

  // null quando needsDrying é false (AC 5, invariante mantido também no PATCH).
  @Column({ name: 'drying_temperature_c', type: 'double precision', nullable: true })
  dryingTemperatureC: number | null;

  @Column({ name: 'drying_hours', type: 'double precision', nullable: true })
  dryingHours: number | null;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
