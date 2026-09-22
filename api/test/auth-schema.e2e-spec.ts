import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource, QueryFailedError } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { deleteUsers, sha256 } from './auth-helper.js';

const EMAILS = ['schema-a@test.local', 'schema-b@test.local', 'schema-c@test.local'];

async function codeOf(query: Promise<unknown>): Promise<string | undefined> {
  try {
    await query;
  } catch (error) {
    if (error instanceof QueryFailedError) {
      return (error.driverError as { code?: string }).code;
    }
    throw error;
  }
  return undefined;
}

describe('Auth schema (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
    await deleteUsers(dataSource, EMAILS);
  });

  afterAll(async () => {
    await deleteUsers(dataSource, EMAILS);
    await app.close();
    vi.restoreAllMocks();
  });

  const insertUser = (email: string, role: string | null) =>
    dataSource.query(
      `INSERT INTO users (name, email, role, password_hash) VALUES ('X', $1, $2, 'h') RETURNING id, active`,
      [email, role],
    ) as Promise<Array<{ id: string; active: boolean }>>;

  it('users constraints', async () => {
    const [created] = await insertUser('schema-a@test.local', 'production');
    expect(created.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(created.active).toBe(true);

    expect(await codeOf(insertUser('schema-a@test.local', 'sales'))).toBe('23505');
    expect(await codeOf(insertUser('schema-b@test.local', 'owner'))).toBe('22P02');
    expect(await codeOf(insertUser('schema-b@test.local', null))).toBe('23502');
  });

  it('sessions constraints', async () => {
    const [user] = await insertUser('schema-c@test.local', 'sales');
    const insertSession = (userId: string, hash: string) =>
      dataSource.query(
        `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 day')`,
        [userId, hash],
      );
    await insertSession(user.id, sha256('schema-1'));
    expect(await codeOf(insertSession(user.id, sha256('schema-1')))).toBe('23505');
    expect(
      await codeOf(insertSession('00000000-0000-4000-8000-000000000000', sha256('schema-2'))),
    ).toBe('23503');

    await deleteUsers(dataSource, ['schema-c@test.local']);
    const left = (await dataSource.query('SELECT count(*)::int AS n FROM sessions WHERE user_id = $1', [
      user.id,
    ])) as Array<{ n: number }>;
    expect(left[0].n).toBe(0);
  });
});
