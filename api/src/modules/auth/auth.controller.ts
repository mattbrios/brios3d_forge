import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import type { AuthUser } from './auth.types.js';
import { CurrentUser } from './current-user.decorator.js';
import { LoginAuthDto } from './dto/login-auth.dto.js';
import { Public } from './public.decorator.js';
import {
  SESSION_COOKIE,
  clearSessionCookieOptions,
  readSessionToken,
  sessionCookieOptions,
} from './session-cookie.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginAuthDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthUser> {
    const { user, token } = await this.auth.login(dto.email, dto.password);
    response.cookie(SESSION_COOKIE, token, sessionCookieOptions(this.env));
    return user;
  }

  // Público e idempotente: sem sessão, só expira o cookie.
  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const token = readSessionToken(request.headers.cookie);
    if (token) {
      await this.auth.logout(token);
    }
    response.clearCookie(SESSION_COOKIE, clearSessionCookieOptions(this.env));
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }

  private readonly env = (key: string): string | undefined => this.config.get<string>(key);
}
