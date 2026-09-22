import type { DataSource } from 'typeorm';
import { SETTINGS_ID } from '../src/modules/settings/entities/settings.entity.js';

export interface SettingsFields {
  energyTariffCentsPerKwh?: number;
  laborCentsPerHour?: number;
  defaultMarginRate?: number;
  failureRate?: number;
  purgeRate?: number;
  maintenanceCentsPerHour?: number;
  productiveHoursPerMonth?: number;
}

// Repõe a linha única de Settings nos defaults do seed, sem depender da ordem dos testes.
export async function resetSettings(dataSource: DataSource, fields: SettingsFields = {}): Promise<void> {
  await dataSource.query(
    `UPDATE settings SET
       energy_tariff_cents_per_kwh = $1,
       labor_cents_per_hour = $2,
       default_margin_rate = $3,
       failure_rate = $4,
       purge_rate = $5,
       maintenance_cents_per_hour = $6,
       productive_hours_per_month = $7
     WHERE id = $8`,
    [
      fields.energyTariffCentsPerKwh ?? 0,
      fields.laborCentsPerHour ?? 0,
      fields.defaultMarginRate ?? 0,
      fields.failureRate ?? 0,
      fields.purgeRate ?? 0,
      fields.maintenanceCentsPerHour ?? 0,
      fields.productiveHoursPerMonth ?? 1,
      SETTINGS_ID,
    ],
  );
  await dataSource.query('DELETE FROM fixed_cost_items WHERE settings_id = $1', [SETTINGS_ID]);
}

export async function deleteSalesChannels(dataSource: DataSource, names: string[]): Promise<void> {
  await dataSource.query('DELETE FROM sales_channels WHERE name = ANY($1)', [names]);
}

interface NewSalesChannel {
  name: string;
  taxRate?: number;
  feeRate?: number;
  active?: boolean;
}

// Grava o canal direto no banco, sem passar pela rota, para preparar o estado de um teste.
export async function createSalesChannel(dataSource: DataSource, channel: NewSalesChannel): Promise<string> {
  const rows: Array<{ id: string }> = await dataSource.query(
    `INSERT INTO sales_channels (name, tax_rate, fee_rate, active) VALUES ($1, $2, $3, $4) RETURNING id`,
    [channel.name, channel.taxRate ?? 0, channel.feeRate ?? 0, channel.active ?? true],
  );
  return rows[0].id;
}
