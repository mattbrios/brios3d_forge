import { buildTypeOrmOptions } from './typeorm-options.js';

describe('TypeORM options', () => {
  it('synchronize is always false', async () => {
    for (const nodeEnv of ['development', 'test', 'production']) {
      const env: Record<string, string> = { NODE_ENV: nodeEnv };
      expect(buildTypeOrmOptions((key) => env[key]).synchronize).toBe(false);

      vi.stubEnv('NODE_ENV', nodeEnv);
      vi.resetModules();
      const { default: dataSource } = await import('./data-source.js');
      expect(dataSource.options.synchronize).toBe(false);
    }
    vi.unstubAllEnvs();
  });
});
