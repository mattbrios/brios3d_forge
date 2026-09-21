import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp, resolvePort } from './app.setup.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: process.env.FRONTEND_URL ?? "http://localhost:3000" });
  configureApp(app);
  await app.listen(resolvePort(process.env));
}
await bootstrap();
