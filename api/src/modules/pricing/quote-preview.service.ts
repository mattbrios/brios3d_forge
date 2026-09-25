import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateQuotePreviewDto } from './dto/create-quote-preview.dto.js';
import { PricingService } from './pricing.service.js';
import type { ChannelInput, MaterialInput, PricingInput, SupplyInput } from './pricing.types.js';
import {
  channelNotFound,
  materialNotFound,
  materialWithoutAverageCost,
  printerNotFound,
  stockItemNotFound,
  stockItemWithoutAverageCost,
  type QuotePreviewMaterial,
  type QuotePreviewResult,
  type QuotePreviewSupply,
} from './quote-preview.types.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { MaterialsService } from '../materials/materials.service.js';
import { PrintersService } from '../printers/printers.service.js';
import { SalesChannelsService } from '../settings/sales-channels.service.js';
import { SettingsService } from '../settings/settings.service.js';

// Fase 12: serviço de aplicação que resolve ids de cadastro para o PricingInput (Fase 1, puro,
// sem alteração). Nada aqui persiste dado nenhum - é a mesma leitura de POST /pricing/calculate,
// só que buscando o custo em quatro fontes em vez de recebê-lo já digitado.
@Injectable()
export class QuotePreviewService {
  constructor(
    private readonly inventory: InventoryService,
    private readonly materials: MaterialsService,
    private readonly printers: PrintersService,
    private readonly settings: SettingsService,
    private readonly salesChannels: SalesChannelsService,
    private readonly pricingService: PricingService,
  ) {}

  async preview(dto: CreateQuotePreviewDto): Promise<QuotePreviewResult> {
    const [printer, settingsResponse, materialsSummary] = await Promise.all([
      this.resolvePrinter(dto.printerId),
      this.settings.get(),
      this.inventory.materialsSummary({}),
    ]);

    const summaryByMaterialId = new Map(
      materialsSummary.items.map((item) => [item.materialId, item.avgCostCentsPerGram]),
    );

    const [resolvedMaterials, resolvedSupplies, resolvedChannels] = await Promise.all([
      Promise.all(dto.materials.map((line) => this.resolveMaterial(line, summaryByMaterialId))),
      Promise.all(dto.supplies.map((line) => this.resolveSupply(line))),
      Promise.all(dto.channelIds.map((channelId) => this.resolveChannel(channelId))),
    ]);

    const materialInputs: MaterialInput[] = resolvedMaterials.map((material, index) => ({
      grams: dto.materials[index].grams,
      costPerGramCents: material.avgCostCentsPerGram,
    }));
    const supplyInputs: SupplyInput[] = resolvedSupplies.map((supply, index) => ({
      quantity: dto.supplies[index].quantity,
      unitCostCents: supply.avgCostCents,
    }));
    // Placement (ver checks.md ## Intent): o pricing puro (Fase 1) só tem um taxRate global e
    // um feeRate por canal. O cadastro de canal (Fase 5) guarda taxRate e feeRate por canal, e
    // valida defaultMarginRate + channel.taxRate + channel.feeRate < 1. Para preservar a mesma
    // regra sem alterar o pricing puro, marginRate vem de settings.defaultMarginRate, taxRate do
    // PricingInput fica em 0, e cada canal soma seu próprio taxRate ao feeRate.
    const channelInputs: ChannelInput[] = resolvedChannels.map((channel) => ({
      name: channel.name,
      feeRate: channel.taxRate + channel.feeRate,
    }));

    const pricingInput: PricingInput = {
      quantity: dto.quantity,
      printHours: dto.printHours,
      materials: materialInputs,
      printer: {
        powerWatts: printer.powerWatts,
        costCents: printer.acquisitionCostCents,
        lifespanHours: printer.lifespanHours,
      },
      energyTariffCentsPerKwh: settingsResponse.energyTariffCentsPerKwh,
      maintenanceCentsPerHour: settingsResponse.maintenanceCentsPerHour,
      labor: {
        prepHours: dto.labor.prepHours,
        slicingHours: dto.labor.slicingHours,
        postProcessingHours: dto.labor.postProcessingHours,
        centsPerHour: dto.labor.centsPerHour,
      },
      supplies: supplyInputs,
      fixedCosts: {
        monthlyCents: settingsResponse.fixedCostItems.reduce((sum, item) => sum + item.monthlyCents, 0),
        productiveHoursPerMonth: settingsResponse.productiveHoursPerMonth,
      },
      purgeRate: settingsResponse.purgeRate,
      failureRate: settingsResponse.failureRate,
      marginRate: settingsResponse.defaultMarginRate,
      taxRate: 0,
      minimumOrderCents: dto.minimumOrderCents ?? 0,
      channels: channelInputs,
    };

    const result = this.pricingService.calculate(pricingInput);

    // PricingService.calculate preserva a ordem de input.channels (Fase 1), a mesma ordem de
    // dto.channelIds/resolvedChannels: casamento por índice, sem precisar casar por nome.
    return {
      ...result,
      printer: { id: printer.id, name: printer.name },
      materials: resolvedMaterials,
      supplies: resolvedSupplies,
      channels: result.channels.map((channelPrice, index) => ({
        ...channelPrice,
        id: resolvedChannels[index].id,
      })),
    };
  }

  private async resolvePrinter(printerId: string) {
    try {
      return await this.printers.getById(printerId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(printerNotFound(printerId));
      }
      throw error;
    }
  }

  private async resolveMaterial(
    line: { materialId: string; grams: number },
    summaryByMaterialId: Map<string, number | null>,
  ): Promise<QuotePreviewMaterial> {
    const material = await this.materials.getById(line.materialId).catch((error: unknown) => {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(materialNotFound(line.materialId));
      }
      throw error;
    });

    const avgCostCentsPerGram = summaryByMaterialId.get(line.materialId) ?? null;
    const name = `${material.type} · ${material.brand} · ${material.color}`;
    if (avgCostCentsPerGram === null) {
      throw new BadRequestException(materialWithoutAverageCost(name));
    }

    return { materialId: material.id, name, avgCostCentsPerGram };
  }

  private async resolveSupply(line: { stockItemId: string; quantity: number }): Promise<QuotePreviewSupply> {
    const item = await this.inventory.getItemById(line.stockItemId).catch((error: unknown) => {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(stockItemNotFound(line.stockItemId));
      }
      throw error;
    });

    if (item.avgCostCents === null) {
      throw new BadRequestException(stockItemWithoutAverageCost(item.name));
    }

    return { stockItemId: item.id, name: item.name, avgCostCents: item.avgCostCents };
  }

  private async resolveChannel(
    channelId: string,
  ): Promise<{ id: string; name: string; taxRate: number; feeRate: number }> {
    const channel = await this.salesChannels.getById(channelId).catch((error: unknown) => {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(channelNotFound(channelId));
      }
      throw error;
    });
    return { id: channel.id, name: channel.name, taxRate: channel.taxRate, feeRate: channel.feeRate };
  }
}
