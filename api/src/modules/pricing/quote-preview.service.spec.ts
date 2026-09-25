import type { InventoryService } from '../inventory/inventory.service.js';
import type { MaterialsService } from '../materials/materials.service.js';
import type { PrintersService } from '../printers/printers.service.js';
import type { SalesChannelsService } from '../settings/sales-channels.service.js';
import type { SettingsService } from '../settings/settings.service.js';
import { CreateQuotePreviewDto } from './dto/create-quote-preview.dto.js';
import { PricingService } from './pricing.service.js';
import { QuotePreviewService } from './quote-preview.service.js';

// C12 (checks.md): monta um PricingInput a partir de mocks e confirma que o resultado bate com
// uma chamada direta a PricingService.calculate com o mesmo PricingInput montado à mão.
describe('QuotePreviewService', () => {
  it('builds a PricingInput from the resolved fixtures and matches a direct PricingService.calculate call', async () => {
    const materialId = 'a0000000-0000-0000-0000-000000000001';
    const stockItemId = 'a0000000-0000-0000-0000-000000000002';
    const printerId = 'a0000000-0000-0000-0000-000000000003';
    const channelId = 'a0000000-0000-0000-0000-000000000004';

    const inventory = {
      materialsSummary: async () => ({
        items: [{ materialId, totalBalanceGrams: 2000, avgCostCentsPerGram: 11, rollCount: 2 }],
      }),
      getItemById: async (id: string) => {
        expect(id).toBe(stockItemId);
        return {
          id: stockItemId,
          category: 'insumo',
          name: 'Parafuso M3x8',
          sku: null,
          unitOfMeasure: 'un',
          location: null,
          preferredSupplierId: null,
          balanceQuantity: 100,
          minimumQuantity: null,
          avgCostCents: 500,
          compatiblePrinterIds: [],
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          movements: [],
        };
      },
    } as unknown as InventoryService;

    const materials = {
      getById: async (id: string) => {
        expect(id).toBe(materialId);
        return {
          id: materialId,
          type: 'PLA',
          brand: 'Marca X',
          color: 'Preto',
          densityGCm3: 1.24,
          nozzleTempC: 200,
          bedTempC: 60,
          needsDrying: false,
          dryingTemperatureC: null,
          dryingHours: null,
          active: true,
          minimumStockGrams: null,
        };
      },
    } as unknown as MaterialsService;

    const printers = {
      getById: async (id: string) => {
        expect(id).toBe(printerId);
        return {
          id: printerId,
          name: 'Bambu X1C',
          acquisitionCostCents: 400000,
          lifespanHours: 5000,
          powerWatts: 250,
          hourmeterHours: 0,
          nozzles: [],
          hasAms: false,
          amsSlots: null,
          active: true,
        };
      },
    } as unknown as PrintersService;

    const settings = {
      get: async () => ({
        energyTariffCentsPerKwh: 80,
        laborCentsPerHour: 3000,
        defaultMarginRate: 0.3,
        failureRate: 0.1,
        purgeRate: 0.05,
        maintenanceCentsPerHour: 50,
        productiveHoursPerMonth: 300,
        fixedCostItems: [{ id: 'x', name: 'Aluguel', monthlyCents: 60000 }],
      }),
    } as unknown as SettingsService;

    const salesChannels = {
      getById: async (id: string) => {
        expect(id).toBe(channelId);
        return { id: channelId, name: 'Balcão', taxRate: 0.06, feeRate: 0 };
      },
    } as unknown as SalesChannelsService;

    const pricingService = new PricingService();
    const service = new QuotePreviewService(inventory, materials, printers, settings, salesChannels, pricingService);

    const dto: CreateQuotePreviewDto = {
      printerId,
      materials: [{ materialId, grams: 100 }],
      supplies: [{ stockItemId, quantity: 2 }],
      printHours: 5,
      labor: { prepHours: 0.25, slicingHours: 0.25, postProcessingHours: 0.5, centsPerHour: 3000 },
      quantity: 1,
      channelIds: [channelId],
    };

    const result = await service.preview(dto);

    // Mesmo PricingInput, montado à mão a partir dos mocks acima (não lido de volta do result).
    const expected = pricingService.calculate({
      quantity: 1,
      printHours: 5,
      materials: [{ grams: 100, costPerGramCents: 11 }],
      printer: { powerWatts: 250, costCents: 400000, lifespanHours: 5000 },
      energyTariffCentsPerKwh: 80,
      maintenanceCentsPerHour: 50,
      labor: { prepHours: 0.25, slicingHours: 0.25, postProcessingHours: 0.5, centsPerHour: 3000 },
      supplies: [{ quantity: 2, unitCostCents: 500 }],
      fixedCosts: { monthlyCents: 60000, productiveHoursPerMonth: 300 },
      purgeRate: 0.05,
      failureRate: 0.1,
      marginRate: 0.3,
      taxRate: 0,
      minimumOrderCents: 0,
      channels: [{ name: 'Balcão', feeRate: 0.06 }],
    });

    expect(result.costs).toEqual(expected.costs);
    expect(result.channels).toEqual([{ ...expected.channels[0], id: channelId }]);
    expect(result.printer).toEqual({ id: printerId, name: 'Bambu X1C' });
    expect(result.materials).toEqual([
      { materialId, name: 'PLA · Marca X · Preto', avgCostCentsPerGram: 11 },
    ]);
    expect(result.supplies).toEqual([{ stockItemId, name: 'Parafuso M3x8', avgCostCents: 500 }]);
  });
});
