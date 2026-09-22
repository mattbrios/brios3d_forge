import { randomBytes, scryptSync } from 'node:crypto';
import { hashPassword, verifyPassword } from './password.js';

const FORMAT = /^scrypt\$N=131072,r=8,p=1\$([A-Za-z0-9+/]+={0,2})\$([A-Za-z0-9+/]+={0,2})$/;

describe('password hashing', () => {
  it('scrypt format', async () => {
    const stored = await hashPassword('senha-correta-12');
    const match = FORMAT.exec(stored);
    expect(match).not.toBeNull();
    expect(Buffer.from(match![1], 'base64')).toHaveLength(16);
    expect(Buffer.from(match![2], 'base64')).toHaveLength(64);

    expect(await hashPassword('senha-correta-12')).not.toBe(stored);
    expect(await verifyPassword('senha-correta-12', stored)).toBe(true);
    expect(await verifyPassword('senha-errada-12', stored)).toBe(false);
  });

  it('verifies with the parameters in the hash', async () => {
    const salt = randomBytes(16);
    const hash = scryptSync('senha-correta-12', salt, 64, { N: 16384, r: 8, p: 1 });
    const stored = `scrypt$N=16384,r=8,p=1$${salt.toString('base64')}$${hash.toString('base64')}`;
    expect(await verifyPassword('senha-correta-12', stored)).toBe(true);
    expect(await verifyPassword('senha-errada-12', stored)).toBe(false);

    const short = scryptSync('senha-correta-12', salt, 32, { N: 16384, r: 8, p: 1 });
    const malformed = [
      '',
      'bcrypt$x',
      'scrypt$N=abc,r=8,p=1$AA==$AA==',
      `scrypt$N=16384,r=8,p=1$${salt.toString('base64')}$${short.toString('base64')}`,
    ];
    for (const value of malformed) {
      await expect(verifyPassword('senha-correta-12', value)).resolves.toBe(false);
    }
  });
  it('invalid scrypt parameters are false', async () => {
    const salt = randomBytes(16).toString('base64');
    const hash = randomBytes(64).toString('base64');
    for (const params of ['N=3,r=8,p=1', 'N=1048576,r=8,p=1']) {
      await expect(verifyPassword('senha-correta-12', `scrypt$${params}$${salt}$${hash}`)).resolves.toBe(
        false,
      );
    }
  });
});
