import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppExceptionFilter } from './common/errors/app-exception.filter';

/**
 * Configuracao compartilhada entre o processo real e os testes e2e.
 *
 * Existe para que o teste exercite a mesma aplicacao que sobe em producao. Se
 * o pipe e o filtro fossem montados so no main.ts, o teste veria o formato de
 * erro cru do Nest e passaria enquanto o cliente real recebe outra coisa.
 */
export function configureApp(app: INestApplication): INestApplication {
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

  return app;
}
