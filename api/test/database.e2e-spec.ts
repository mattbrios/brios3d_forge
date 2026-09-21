import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';

describe('Test database (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('connects to the test database', async () => {
    const rows: Array<{ current_database: string }> = await dataSource.query(
      'select current_database()',
    );
    expect(rows[0].current_database).toBe(process.env.DB_NAME_TEST ?? 'forge_test');
    expect(rows[0].current_database).toBe('forge_test');
  });

  it('migrations table exists', async () => {
    const rows: Array<{ table: string | null }> = await dataSource.query(
      "select to_regclass('public.migrations')::text as table",
    );
    expect(rows[0].table).toBe('migrations');
  });
});
