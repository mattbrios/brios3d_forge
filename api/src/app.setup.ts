import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';

const DEFAULT_PORT = 3001;

// Usado pelo main.ts e pelos testes e2e, para as duas montagens da app serem iguais.
export function configureApp(app: INestApplication): void {
  // Credenciais (cookie de sessão) só para a origem do web (AD-016).
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
}

export function resolvePort(env: Record<string, string | undefined>): number {
  return env.PORT ? Number(env.PORT) : DEFAULT_PORT;
}
