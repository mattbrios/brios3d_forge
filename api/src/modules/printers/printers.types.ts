import type { PrinterInput } from '../pricing/pricing.types.js';
import type { Nozzle, Printer } from './entities/printer.entity.js';

// Contrato de GET/POST/PATCH /printers.
export interface PrinterResponse {
  id: string;
  name: string;
  acquisitionCostCents: number;
  lifespanHours: number;
  powerWatts: number;
  hourmeterHours: number;
  nozzles: Nozzle[];
  hasAms: boolean;
  amsSlots: number | null;
  active: boolean;
}

export interface ListPrintersResponse {
  items: PrinterResponse[];
  total: number;
  page: number;
  pageSize: number;
}

export function toPrinterResponse(printer: Printer): PrinterResponse {
  return {
    id: printer.id,
    name: printer.name,
    acquisitionCostCents: printer.acquisitionCostCents,
    lifespanHours: printer.lifespanHours,
    powerWatts: printer.powerWatts,
    hourmeterHours: printer.hourmeterHours,
    nozzles: printer.nozzles,
    hasAms: printer.hasAms,
    amsSlots: printer.amsSlots,
    active: printer.active,
  };
}

// Door 4 (plano): liga um Printer persistido ao PrinterInput que pricing.types.ts (Fase 1) já
// espera, sem nenhum outro campo e sem conversão de unidade (AC 31).
export function toPricingPrinterInput(printer: Printer): PrinterInput {
  return {
    powerWatts: printer.powerWatts,
    costCents: printer.acquisitionCostCents,
    lifespanHours: printer.lifespanHours,
  };
}

export const PRINTER_NOT_FOUND = 'Impressora não encontrada';
export const AMS_SLOTS_REQUIRED = 'Informe amsSlots maior ou igual a 1 quando hasAms for true';

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
