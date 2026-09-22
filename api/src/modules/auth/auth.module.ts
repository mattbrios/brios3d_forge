import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { Session } from './entities/session.entity.js';
import { LoginAttempts } from './login-attempts.js';
import { PasswordHasher } from './password.js';

@Module({
  imports: [TypeOrmModule.forFeature([User, Session])],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordHasher,
    { provide: LoginAttempts, useFactory: () => new LoginAttempts() },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
