import { DataSource } from 'typeorm';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  it('ok when select 1 succeeds', async () => {
    const query = vi.fn().mockResolvedValue([{ '?column?': 1 }]);
    const service = new HealthService({ query } as unknown as DataSource);

    await expect(service.check()).resolves.toEqual({ status: 'ok' });
    expect(query).toHaveBeenCalledWith('SELECT 1');
  });
});
