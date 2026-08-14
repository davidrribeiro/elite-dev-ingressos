import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import {
  PublicTicketsController,
  TicketsController,
} from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [CatalogModule],
  controllers: [TicketsController, PublicTicketsController],
  providers: [TicketsService],
  // PaymentsModule chama issueForReservation na aprovacao.
  exports: [TicketsService],
})
export class TicketsModule {}
