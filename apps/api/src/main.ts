import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.WEB_BASE_URL ?? 'http://localhost:3000',
    credentials: true,
  });

  configureApp(app);

  await app.listen(process.env.API_PORT ?? 3333);
}
void bootstrap();
