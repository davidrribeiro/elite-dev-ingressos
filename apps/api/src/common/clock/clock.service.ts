import { Injectable } from '@nestjs/common';

/**
 * Relogio injetavel.
 *
 * Toda regra que depende da hora atual passa por aqui em vez de chamar
 * `new Date()` direto. E o que permite testar expiracao de reserva sem `sleep`:
 * o teste troca a implementacao por um relogio controlado e avanca o tempo a
 * vontade.
 *
 * Ver specs/001-decisoes-em-aberto/research.md R11.
 */
@Injectable()
export class ClockService {
  now(): Date {
    return new Date();
  }

  /** Instante daqui a N minutos. Usado para calcular o prazo da reserva. */
  minutesFromNow(minutes: number): Date {
    return new Date(this.now().getTime() + minutes * 60_000);
  }
}
