import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import {
  EventsController,
  OrganizerEventsController,
} from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [CatalogModule],
  controllers: [EventsController, OrganizerEventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
