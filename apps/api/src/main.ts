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

  // Railway injeta PORT e espera a app escutar nele; API_PORT continua
  // valendo pra dev local e outros ambientes que nao definem PORT.
  await app.listen(process.env.PORT ?? process.env.API_PORT ?? 3333);
}
void bootstrap();
