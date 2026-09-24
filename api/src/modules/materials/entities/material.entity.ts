import { Check, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('materials')
// Fase 11, door 1: o piso é uma coluna nula da própria tabela, e o CHECK é o backstop do 400 da
// API contra um valor negativo (AD-023).
@Check('materials_minimum_non_negative', '"minimum_stock_grams" IS NULL OR "minimum_stock_grams" >= 0')
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

  // Fase 11, door 1: piso de reposição em gramas, comparado com a SOMA dos rolos não descartados.
  // `null` é "sem política de reposição", nunca "mínimo zero" - por isso não tem DEFAULT.
  @Column({ name: 'minimum_stock_grams', type: 'double precision', nullable: true })
  minimumStockGrams: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
