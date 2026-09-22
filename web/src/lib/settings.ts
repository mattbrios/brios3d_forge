// Contrato de GET/PATCH /settings (Fase 5).
export interface FixedCostItem {
  id: string;
  name: string;
  monthlyCents: number;
}

export interface Settings {
  energyTariffCentsPerKwh: number;
  laborCentsPerHour: number;
  defaultMarginRate: number;
  failureRate: number;
  purgeRate: number;
  maintenanceCentsPerHour: number;
  productiveHoursPerMonth: number;
  fixedCostItems: FixedCostItem[];
}
