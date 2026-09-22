import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator.js';
import { HealthService, HealthStatus } from './health.service.js';

// Público: a CI e o web conferem a API sem login.
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  check(): Promise<HealthStatus> {
    return this.healthService.check();
  }
}
