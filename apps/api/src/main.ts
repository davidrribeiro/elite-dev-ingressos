import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.WEB_BASE_URL ?? 'http://localhost:3000',
    credentials: true,
  });

  // whitelist descarta campos nao declarados no DTO; transform converte
  // os tipos primitivos vindos da query string.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.API_PORT ?? 3333);
}
void bootstrap();
