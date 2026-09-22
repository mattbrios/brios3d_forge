import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentSession } from '../auth/current-session.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '../auth/auth.types.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UsersService } from './users.service.js';
import type { PublicUser } from './users.types.js';

// Sem @Roles(): só admin (door 1, AC 1-4).
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(): Promise<PublicUser[]> {
    return this.users.list();
  }

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateUserDto): Promise<PublicUser> {
    return this.users.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actingUser: AuthUser,
    @CurrentSession() actingSessionId: string,
  ): Promise<PublicUser> {
    return this.users.update(id, dto, actingUser.id, actingSessionId);
  }
}
