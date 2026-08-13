import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/jwt-auth.guard';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Sinal de vida da API. Publico de proposito: e o que a plataforma de deploy
   * consulta para saber se o processo subiu, e ela nao tem token.
   */
  @Public()
  @Get('health')
  health() {
    return this.appService.health();
  }
}
