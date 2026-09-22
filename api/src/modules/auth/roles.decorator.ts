import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../users/entities/user.entity.js';

export const ROLES = 'roles';

// Papéis extras liberados numa rota protegida, além do admin (RolesGuard, door 1).
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES, roles);
