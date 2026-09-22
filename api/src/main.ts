import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp, resolvePort } from './app.setup.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  await app.listen(resolvePort(process.env));
}
await bootstrap();
