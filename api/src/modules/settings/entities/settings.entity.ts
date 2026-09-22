import { Column, Entity, PrimaryColumn } from 'typeorm';

// Linha única da calculadora (door 1): sempre este id, nunca uma segunda linha.
export const SETTINGS_ID = '00000000-0000-0000-0000-000000000101';

@Entity('settings')
export class Settings {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'energy_tariff_cents_per_kwh', type: 'double precision' })
  energyTariffCentsPerKwh: number;

  @Column({ name: 'labor_cents_per_hour', type: 'double precision' })
  laborCentsPerHour: number;

  @Column({ name: 'default_margin_rate', type: 'double precision' })
  defaultMarginRate: number;

  @Column({ name: 'failure_rate', type: 'double precision' })
  failureRate: number;

  @Column({ name: 'purge_rate', type: 'double precision' })
  purgeRate: number;

  @Column({ name: 'maintenance_cents_per_hour', type: 'double precision' })
  maintenanceCentsPerHour: number;

  @Column({ name: 'productive_hours_per_month', type: 'double precision' })
  productiveHoursPerMonth: number;
}
