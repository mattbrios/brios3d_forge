import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

// Formato gravado: scrypt$N=<n>,r=<r>,p=<p>$<salt base64>$<hash base64>.
// Os parâmetros ficam na string para poderem subir sem invalidar hashes antigos.
const PARAMS = { N: 131072, r: 8, p: 1 } as const;
const SALT_BYTES = 16;
const HASH_BYTES = 64;
// N=2^17 e r=8 usam 128 MB; o padrão do Node (32 MB) recusaria.
const MAX_MEM = 256 * 1024 * 1024;
const FORMAT = /^scrypt\$N=(\d+),r=(\d+),p=(\d+)\$([A-Za-z0-9+/]+={0,2})\$([A-Za-z0-9+/]+={0,2})$/;

function derive(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, HASH_BYTES, { ...options, maxmem: MAX_MEM }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await derive(password, salt, PARAMS);
  const { N, r, p } = PARAMS;
  return `scrypt$N=${N},r=${r},p=${p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const match = FORMAT.exec(stored);
  if (!match) {
    return false;
  }
  const [, n, r, p, salt, hash] = match;
  const expected = Buffer.from(hash, 'base64');
  if (expected.length !== HASH_BYTES) {
    return false;
  }
  try {
    const actual = await derive(password, Buffer.from(salt, 'base64'), {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// Injetável para o serviço de auth poder ser testado sem o custo do scrypt.
@Injectable()
export class PasswordHasher {
  hash(password: string): Promise<string> {
    return hashPassword(password);
  }

  verify(password: string, stored: string): Promise<boolean> {
    return verifyPassword(password, stored);
  }
}
