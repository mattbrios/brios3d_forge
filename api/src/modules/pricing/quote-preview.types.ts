import type { ChannelPrice, PricingResult } from './pricing.types.js';

// Fase 12: nomes resolvidos que a tela precisa exibir sem uma segunda consulta (AC 6).
export interface QuotePreviewMaterial {
  materialId: string;
  name: string;
  avgCostCentsPerGram: number;
}

export interface QuotePreviewSupply {
  stockItemId: string;
  name: string;
  avgCostCents: number;
}

export interface QuotePreviewPrinter {
  id: string;
  name: string;
}

// `channels` do PricingResult (Fase 1) já carrega o nome (ChannelPrice.name); a Fase 12 só
// acrescenta o id do canal cadastrado a cada entrada, sem um array paralelo (AC 6).
export interface QuotePreviewChannel extends ChannelPrice {
  id: string;
}

// Contrato de POST /pricing/quote-preview: o PricingResult (Fase 1, sem alteração) mais os
// nomes resolvidos de cada entidade usada no cálculo.
export interface QuotePreviewResult extends Omit<PricingResult, 'channels'> {
  printer: QuotePreviewPrinter;
  materials: QuotePreviewMaterial[];
  supplies: QuotePreviewSupply[];
  channels: QuotePreviewChannel[];
}

// Mensagens com o id/nome interpolado (placement, ver checks.md ## Intent): nenhuma constante
// existente de <módulo>.types.ts inclui o id/nome na mensagem, então cada uma tem a sua própria
// aqui, sem alterar as constantes originais.
export const materialNotFound = (id: string): string => `Material ${id} não encontrado`;
export const printerNotFound = (id: string): string => `Impressora ${id} não encontrada`;
export const stockItemNotFound = (id: string): string => `Insumo ${id} não encontrado`;
export const channelNotFound = (id: string): string => `Canal ${id} não encontrado`;
export const materialWithoutAverageCost = (name: string): string =>
  `Material sem custo médio disponível: ${name}`;
export const stockItemWithoutAverageCost = (name: string): string =>
  `Insumo sem custo médio disponível: ${name}`;
