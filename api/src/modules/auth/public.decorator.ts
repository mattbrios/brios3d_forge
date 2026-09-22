import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';

// Libera a rota do guard global de autenticação (AD-015).
export const Public = () => SetMetadata(IS_PUBLIC, true);
