import type { Repository } from 'typeorm';
import { CreateRollDto } from './dto/create-roll.dto.js';
import { FilamentRoll } from './entities/filament-roll.entity.js';
import { InventoryMovement } from './entities/inventory-movement.entity.js';
import { InventoryService } from './inventory.service.js';
import { StockItem } from './entities/stock-item.entity.js';
import { Material } from '../materials/entities/material.entity.js';

const VALID_DTO: CreateRollDto = {
  materialId: 'material-1',
  initialWeightGrams: 1000,
  spoolTareGrams: 250,
  acquisitionCostCents: 12000,
};

function setup() {
  const material = { id: 'material-1', active: true };
  const materialsRepo = { findOne: vi.fn().mockResolvedValue(material) };
  const rollsRepoMock = {
    create: vi.fn((input: object) => input),
    save: vi.fn(async (roll: object) => ({ id: 'roll-1', ...roll })),
  };
  const movementsRepoMock = {
    create: vi.fn((input: object) => input),
    save: vi.fn().mockRejectedValue(new Error('conexão com o banco caiu')),
  };
  const manager = {
    getRepository: vi.fn((entity: unknown) => {
      if (entity === Material) return materialsRepo;
      if (entity === FilamentRoll) return rollsRepoMock;
      if (entity === InventoryMovement) return movementsRepoMock;
      throw new Error('repositório inesperado na transação');
    }),
  };
  const transaction = vi.fn((callback: (m: unknown) => unknown) => callback(manager));
  const rolls = { manager: { transaction } };
  const movements = {};
  const stockItems = {};
  const service = new InventoryService(
    rolls as unknown as Repository<FilamentRoll>,
    movements as unknown as Repository<InventoryMovement>,
    stockItems as unknown as Repository<StockItem>,
  );
  return { service, rollsRepoMock, movementsRepoMock, transaction };
}

describe('InventoryService', () => {
  it('rolls back the roll when the entrada movement fails to save', async () => {
    const { service, rollsRepoMock, movementsRepoMock, transaction } = setup();

    await expect(service.createRoll(VALID_DTO, 'user-1')).rejects.toThrow('conexão com o banco caiu');

    // A escrita passou mesmo pela transação (AC 5) - sem isto, um `createRoll` que gravasse o
    // rolo e a movimentação fora de `manager.transaction` também deixaria os dois `save` abaixo
    // verdes, sem nenhuma garantia real de reversão.
    expect(transaction).toHaveBeenCalledTimes(1);
    // O rolo foi montado e salvo dentro da mesma transação (AC 5: "já persistido em memória")...
    expect(rollsRepoMock.save).toHaveBeenCalledTimes(1);
    // ...mas nunca há uma segunda chamada compensatória fora da transação revertida: o único
    // save do rolo é o de dentro da própria `manager.transaction`, que o TypeORM desfaz sozinho
    // quando o callback rejeita.
    expect(movementsRepoMock.save).toHaveBeenCalledTimes(1);
  });
});

describe('InventoryService.updateRoll', () => {
  const storedRoll = (overrides: Partial<FilamentRoll> = {}): FilamentRoll =>
    ({
      id: 'roll-1',
      materialId: 'material-1',
      supplierId: null,
      nominalWeightGrams: 1000,
      initialWeightGrams: 1000,
      balanceGrams: 562,
      spoolTareGrams: 250,
      batch: 'L-01',
      purchaseDate: '2026-09-01',
      openedAt: null,
      discardedAt: null,
      location: 'Prateleira A',
      acquisitionCostCents: 12000,
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
      updatedAt: new Date('2026-09-01T00:00:00.000Z'),
      ...overrides,
    }) as FilamentRoll;

  function setupUpdate(roll: FilamentRoll | null) {
    const rolls = {
      findOne: vi.fn().mockResolvedValue(roll),
      save: vi.fn(async (saved: FilamentRoll) => saved),
    };
    const service = new InventoryService(
      rolls as unknown as Repository<FilamentRoll>,
      {} as Repository<InventoryMovement>,
      {} as Repository<StockItem>,
    );
    return { service, rolls };
  }

  it('throws 404 for an unknown roll', async () => {
    const { service, rolls } = setupUpdate(null);
    await expect(service.updateRoll('roll-x', { location: 'B' })).rejects.toMatchObject({
      status: 404,
      message: 'Rolo não encontrado',
    });
    expect(rolls.save).not.toHaveBeenCalled();
  });

  it('throws 409 for a discarded roll', async () => {
    const { service, rolls } = setupUpdate(storedRoll({ discardedAt: new Date('2026-09-10T00:00:00.000Z') }));
    await expect(service.updateRoll('roll-1', { location: 'B' })).rejects.toMatchObject({
      status: 409,
      message: 'Rolo já descartado',
    });
    expect(rolls.save).not.toHaveBeenCalled();
  });

  it('writes every field sent and keeps the balance untouched', async () => {
    const { service } = setupUpdate(storedRoll());
    const response = await service.updateRoll('roll-1', {
      spoolTareGrams: 180,
      nominalWeightGrams: 750,
      batch: 'L-02',
      purchaseDate: '2026-09-15',
      location: 'Prateleira B',
    });
    expect(response).toMatchObject({
      spoolTareGrams: 180,
      nominalWeightGrams: 750,
      batch: 'L-02',
      purchaseDate: '2026-09-15',
      location: 'Prateleira B',
      balanceGrams: 562,
      initialWeightGrams: 1000,
      acquisitionCostCents: 12000,
    });
  });

  it('preserves omitted fields', async () => {
    const { service } = setupUpdate(storedRoll());
    const response = await service.updateRoll('roll-1', { location: 'Prateleira B' });
    expect(response).toMatchObject({
      spoolTareGrams: 250,
      nominalWeightGrams: 1000,
      batch: 'L-01',
      purchaseDate: '2026-09-01',
      location: 'Prateleira B',
    });
  });

  it('clears batch, purchaseDate and location on an explicit null', async () => {
    const { service } = setupUpdate(storedRoll());
    const response = await service.updateRoll('roll-1', { batch: null, purchaseDate: null, location: null });
    expect(response).toMatchObject({ batch: null, purchaseDate: null, location: null, spoolTareGrams: 250 });
  });
});
