import type { FixedCostItem } from './entities/fixed-cost-item.entity.js';
import type { SalesChannel } from './entities/sales-channel.entity.js';
import type { Settings } from './entities/settings.entity.js';

export interface FixedCostItemResponse {
  id: string;
  name: string;
  monthlyCents: number;
}

// Contrato de GET/PATCH /settings (door 1, door 2): sem o id da linha única, que é interno.
export interface SettingsResponse {
  energyTariffCentsPerKwh: number;
  laborCentsPerHour: number;
  defaultMarginRate: number;
  failureRate: number;
  purgeRate: number;
  maintenanceCentsPerHour: number;
  productiveHoursPerMonth: number;
  fixedCostItems: FixedCostItemResponse[];
}

export interface SalesChannelResponse {
  id: string;
  name: string;
  taxRate: number;
  feeRate: number;
  active: boolean;
}

export function toSettingsResponse(settings: Settings, fixedCostItems: FixedCostItem[]): SettingsResponse {
  return {
    energyTariffCentsPerKwh: settings.energyTariffCentsPerKwh,
    laborCentsPerHour: settings.laborCentsPerHour,
    defaultMarginRate: settings.defaultMarginRate,
    failureRate: settings.failureRate,
    purgeRate: settings.purgeRate,
    maintenanceCentsPerHour: settings.maintenanceCentsPerHour,
    productiveHoursPerMonth: settings.productiveHoursPerMonth,
    fixedCostItems: fixedCostItems.map((item) => ({
      id: item.id,
      name: item.name,
      monthlyCents: item.monthlyCents,
    })),
  };
}

export function toSalesChannelResponse(channel: SalesChannel): SalesChannelResponse {
  return {
    id: channel.id,
    name: channel.name,
    taxRate: channel.taxRate,
    feeRate: channel.feeRate,
    active: channel.active,
  };
}

export const EMPTY_SETTINGS_PATCH = 'Informe ao menos um campo para alterar';
export const COMBINED_RATE_TOO_HIGH = 'A soma da margem, imposto e taxa não pode chegar a 100%';
export const DUPLICATE_CHANNEL_NAME = 'Já existe um canal com este nome';
export const CHANNEL_NOT_FOUND = 'Canal não encontrado';
