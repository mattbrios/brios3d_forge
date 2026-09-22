import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminSeed } from './admin-seed.js';
import { User } from './entities/user.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [AdminSeed],
})
export class UsersModule {}
