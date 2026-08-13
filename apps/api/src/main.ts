import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppExceptionFilter } from './common/errors/app-exception.filter';

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

  // Envelope unico de erro. Toda falha sai como { error: { code, message } },
  // e o front decide pelo code.
  app.useGlobalFilters(new AppExceptionFilter());

  await app.listen(process.env.API_PORT ?? 3333);
}
void bootstrap();
