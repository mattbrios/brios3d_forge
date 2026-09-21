import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataSource } from 'typeorm';
import { buildTypeOrmOptions } from './typeorm-options.js';

// Data source do CLI do TypeORM. Os scripts migration:* rodam sobre o build
// (dist/database/data-source.js); a extensão acompanha o arquivo carregado.
const here = dirname(fileURLToPath(import.meta.url));
const ext = import.meta.url.endsWith('.ts') ? 'ts' : 'js';

export default new DataSource({
  ...buildTypeOrmOptions((key) => process.env[key]),
  entities: [join(here, '..', 'modules', '**', 'entities', `*.entity.${ext}`)],
  migrations: [join(here, 'migrations', `*.${ext}`)],
});
