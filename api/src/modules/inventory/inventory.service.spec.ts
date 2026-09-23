import type { Repository } from 'typeorm';
import { CreateRollDto } from './dto/create-roll.dto.js';
import { FilamentRoll } from './entities/filament-roll.entity.js';
import { InventoryMovement } from './entities/inventory-movement.entity.js';
import { InventoryService } from './inventory.service.js';
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
  const service = new InventoryService(
    rolls as unknown as Repository<FilamentRoll>,
    movements as unknown as Repository<InventoryMovement>,
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
