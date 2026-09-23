import type { DataSource } from 'typeorm';
import type { Nozzle } from '../src/modules/printers/entities/printer.entity.js';

interface NewPrinter {
  name: string;
  acquisitionCostCents?: number;
  lifespanHours?: number;
  powerWatts?: number;
  hourmeterHours?: number;
  nozzles?: Nozzle[];
  hasAms?: boolean;
  amsSlots?: number | null;
  active?: boolean;
}

// Grava a impressora direto no banco, sem passar pela rota, para preparar o estado de um teste.
export async function createPrinter(dataSource: DataSource, printer: NewPrinter): Promise<string> {
  const hasAms = printer.hasAms ?? false;
  const rows: Array<{ id: string }> = await dataSource.query(
    `INSERT INTO printers
       (name, acquisition_cost_cents, lifespan_hours, power_watts, hourmeter_hours, nozzles, has_ams, ams_slots, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      printer.name,
      printer.acquisitionCostCents ?? 500000,
      printer.lifespanHours ?? 10000,
      printer.powerWatts ?? 250,
      printer.hourmeterHours ?? 0,
      JSON.stringify(printer.nozzles ?? [{ diameterMm: 0.4, type: 'Hardened Steel' }]),
      hasAms,
      hasAms ? (printer.amsSlots ?? 4) : null,
      printer.active ?? true,
    ],
  );
  return rows[0].id;
}
