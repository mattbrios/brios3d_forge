import type { DataSourceOptions } from 'typeorm';

type EnvReader = (key: string) => string | undefined;

// Conexão compartilhada pela app e pelo CLI de migrations.
// O schema só muda por migration: synchronize fica desligado em todo ambiente.
export function buildTypeOrmOptions(read: EnvReader) {
  return {
    type: 'postgres',
    host: read('DB_HOST') ?? 'localhost',
    port: Number(read('DB_PORT') ?? 5432),
    username: read('DB_USER') ?? 'forge',
    password: read('DB_PASSWORD') ?? 'forge',
    database: read('DB_NAME') ?? 'forge',
    synchronize: false,
  } satisfies DataSourceOptions;
}
