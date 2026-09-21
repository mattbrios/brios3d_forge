import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildTypeOrmOptions } from './database/typeorm-options.js';
import { HealthModule } from './modules/health/health.module.js';
import { PricingModule } from './modules/pricing/pricing.module.js';
import { PrintProfilesModule } from './modules/print-profiles/print-profiles.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...buildTypeOrmOptions((key) => config.get<string>(key)),
        autoLoadEntities: true,
      }),
    }),
    HealthModule,
    PricingModule,
    PrintProfilesModule,
  ],
})
export class AppModule {}
