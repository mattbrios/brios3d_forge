import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { hashPassword } from '../auth/password.js';
import { User } from './entities/user.entity.js';
import { normalizeEmail } from './normalize-email.js';

const MIN_PASSWORD_LENGTH = 12;
const UNIQUE_VIOLATION = '23505';

// Cria o primeiro admin a partir do ambiente. Nunca altera um usuário que já existe.
@Injectable()
export class AdminSeed implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSeed.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const rawEmail = this.config.get<string>('ADMIN_EMAIL');
    const password = this.config.get<string>('ADMIN_PASSWORD');
    if (!rawEmail || !password) {
      this.logger.warn('Seed do admin ignorado: defina ADMIN_EMAIL e ADMIN_PASSWORD');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`ADMIN_PASSWORD precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres`);
    }

    const email = normalizeEmail(rawEmail);
    if (await this.users.exists({ where: { email } })) {
      return;
    }
    try {
      await this.users.insert({
        email,
        name: this.config.get<string>('ADMIN_NAME') || 'Administrador',
        role: 'admin',
        passwordHash: await hashPassword(password),
      });
      this.logger.log(`Admin criado: ${email}`);
    } catch (error) {
      // Outra instância criou o mesmo admin ao mesmo tempo: o índice único decide.
      if (isUniqueViolation(error)) {
        return;
      }
      throw error;
    }
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driverError: unknown = error.driverError;
  return (
    typeof driverError === 'object' &&
    driverError !== null &&
    (driverError as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}
