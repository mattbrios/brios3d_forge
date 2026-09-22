import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import { LessThan, MoreThan, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity.js';
import { normalizeEmail } from '../users/normalize-email.js';
import { INVALID_CREDENTIALS, TOO_MANY_ATTEMPTS, type AuthUser } from './auth.types.js';
import { Session } from './entities/session.entity.js';
import { LoginAttempts } from './login-attempts.js';
import { PasswordHasher } from './password.js';
import { SESSION_TTL_MS, hashSessionToken, newSessionToken } from './session-cookie.js';

export function toAuthUser(user: User): AuthUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  // Hash de referência para e-mail inexistente: o tempo de resposta não revela quem existe.
  private dummyHash: Promise<string> | undefined;

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    private readonly hasher: PasswordHasher,
    private readonly attempts: LoginAttempts,
  ) {}

  async login(rawEmail: string, password: string): Promise<{ user: AuthUser; token: string }> {
    const email = normalizeEmail(rawEmail);
    if (this.attempts.isBlocked(email)) {
      this.logger.warn(`Login blocked: ${email}`);
      throw new HttpException(TOO_MANY_ATTEMPTS, HttpStatus.TOO_MANY_REQUESTS);
    }
    // Conta a tentativa antes do primeiro await: requisições simultâneas não passam do limite.
    // O sucesso zera a contagem logo abaixo.
    this.attempts.recordFailure(email);

    const user = await this.users.findOne({ where: { email } });
    if (!user) {
      await this.hasher.verify(password, await this.referenceHash());
      return this.fail(email, 'unknown email');
    }
    if (!(await this.hasher.verify(password, user.passwordHash))) {
      return this.fail(email, 'wrong password');
    }
    if (!user.active) {
      return this.fail(email, 'inactive');
    }

    this.attempts.recordSuccess(email);
    const now = Date.now();
    await this.sessions.delete({ userId: user.id, expiresAt: LessThan(new Date(now)) });
    const token = newSessionToken();
    await this.sessions.insert({
      userId: user.id,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(now + SESSION_TTL_MS),
    });
    this.logger.log(`Login succeeded: ${email}`);
    return { user: toAuthUser(user), token };
  }

  async userForToken(token: string): Promise<AuthUser | null> {
    const session = await this.sessions.findOne({
      where: { tokenHash: hashSessionToken(token), expiresAt: MoreThan(new Date()) },
      relations: { user: true },
    });
    if (!session?.user.active) {
      return null;
    }
    return toAuthUser(session.user);
  }

  async logout(token: string): Promise<void> {
    await this.sessions.delete({ tokenHash: hashSessionToken(token) });
  }

  // A falha já foi contada no início do login.
  private fail(email: string, reason: string): never {
    this.logger.warn(`Login failed (${reason}): ${email}`);
    throw new UnauthorizedException(INVALID_CREDENTIALS);
  }

  private referenceHash(): Promise<string> {
    this.dummyHash ??= this.hasher.hash(randomBytes(16).toString('hex'));
    return this.dummyHash;
  }
}
