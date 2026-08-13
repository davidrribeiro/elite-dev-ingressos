import { Global, Module } from '@nestjs/common';
import { ClockService } from './clock.service';

// Global: praticamente todo servico de dominio precisa do relogio, e importar o
// modulo em cada um deles seria ruido sem beneficio.
@Global()
@Module({
  providers: [ClockService],
  exports: [ClockService],
})
export class ClockModule {}
