import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { hashPassword } from '../auth/password.js';
import { Session } from '../auth/entities/session.entity.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { User } from './entities/user.entity.js';
import { isUniqueViolation } from './is-unique-violation.js';
import { normalizeEmail } from './normalize-email.js';
import {
  DUPLICATE_EMAIL,
  EMPTY_PATCH,
  LAST_ACTIVE_ADMIN,
  SELF_ROLE_OR_ACTIVE,
  USER_NOT_FOUND,
  toPublicUser,
  type PublicUser,
} from './users.types.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
  ) {}

  async list(): Promise<PublicUser[]> {
    const rows = await this.users.find({ order: { name: 'ASC', email: 'ASC' } });
    return rows.map(toPublicUser);
  }

  async create(dto: CreateUserDto): Promise<PublicUser> {
    const email = normalizeEmail(dto.email);
    try {
      const created = await this.users.save(
        this.users.create({
          name: dto.name,
          email,
          role: dto.role,
          passwordHash: await hashPassword(dto.password),
        }),
      );
      return toPublicUser(created);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(DUPLICATE_EMAIL);
      }
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actingUserId: string,
    actingSessionId: string,
  ): Promise<PublicUser> {
    if (
      dto.name === undefined &&
      dto.email === undefined &&
      dto.role === undefined &&
      dto.active === undefined &&
      dto.password === undefined
    ) {
      throw new BadRequestException(EMPTY_PATCH);
    }
    if ((dto.role !== undefined || dto.active !== undefined) && id === actingUserId) {
      throw new ConflictException(SELF_ROLE_OR_ACTIVE);
    }

    const touchesAdminInvariant = dto.role !== undefined || dto.active !== undefined;
    const newPasswordHash = dto.password !== undefined ? await hashPassword(dto.password) : undefined;
    const newEmail = dto.email !== undefined ? normalizeEmail(dto.email) : undefined;

    const updated = await this.users.manager.transaction(async (manager) => {
      const repo = manager.getRepository(User);
      if (touchesAdminInvariant) {
        // Trava toda linha admin/ativa: uma corrida entre duas mudanças concorrentes serializa
        // aqui, em vez de as duas lerem a mesma contagem desatualizada (door "último admin").
        await repo
          .createQueryBuilder('u')
          .setLock('pessimistic_write')
          .where("u.role = 'admin' AND u.active = true")
          .getMany();
      }

      const user = await repo.findOne({ where: { id } });
      if (!user) {
        throw new NotFoundException(USER_NOT_FOUND);
      }

      const wasActiveAdmin = user.role === 'admin' && user.active;
      const newRole = dto.role ?? user.role;
      const newActive = dto.active ?? user.active;
      if (touchesAdminInvariant && wasActiveAdmin && (newRole !== 'admin' || !newActive)) {
        const activeAdmins = await repo.count({ where: { role: 'admin', active: true } });
        if (activeAdmins - 1 < 1) {
          throw new ConflictException(LAST_ACTIVE_ADMIN);
        }
      }

      if (dto.name !== undefined) user.name = dto.name;
      if (newEmail !== undefined) user.email = newEmail;
      if (dto.role !== undefined) user.role = dto.role;
      if (dto.active !== undefined) user.active = dto.active;
      if (newPasswordHash !== undefined) user.passwordHash = newPasswordHash;

      try {
        await repo.save(user);
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictException(DUPLICATE_EMAIL);
        }
        throw error;
      }

      if (dto.active === false || newPasswordHash !== undefined) {
        // Sempre exclui a sessão que fez a chamada quando o alvo é quem chamou; para outro
        // alvo, `actingSessionId` não pertence a ele e a exclusão não tem efeito.
        await manager.getRepository(Session).delete({ userId: id, id: Not(actingSessionId) });
      }

      return user;
    });

    return toPublicUser(updated);
  }
}
