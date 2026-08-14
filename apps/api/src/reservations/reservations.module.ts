import { Module } from '@nestjs/common';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

@Module({
  controllers: [ReservationsController],
  providers: [ReservationsService],
  // EventsModule chama releaseExpired antes de montar o mapa de assentos.
  exports: [ReservationsService],
})
export class ReservationsModule {}
