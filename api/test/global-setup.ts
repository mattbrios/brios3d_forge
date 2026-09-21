import { execSync } from 'node:child_process';
import { DataSource } from 'typeorm';
import { buildTypeOrmOptions } from '../src/database/typeorm-options.js';

// Cria o banco de teste se ele não existir e aplica as migrations pelo mesmo
// caminho do `npm run migration:run`.
export default async function setup(): Promise<void> {
  const testDatabase = process.env.DB_NAME_TEST ?? 'forge_test';
  const admin = new DataSource({
    ...buildTypeOrmOptions((key) => process.env[key]),
    database: 'postgres',
  });
  await admin.initialize();
  try {
    const rows: unknown[] = await admin.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [testDatabase],
    );
    if (rows.length === 0) {
      await admin.query(`CREATE DATABASE "${testDatabase.replaceAll('"', '""')}"`);
    }
  } finally {
    await admin.destroy();
  }

  execSync('npm run migration:run', {
    stdio: 'inherit',
    env: { ...process.env, DB_NAME: testDatabase },
  });
}
