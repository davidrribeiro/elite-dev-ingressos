import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  controllers: [CatalogController],
  providers: [CatalogService],
  // EventsModule usa o servico para copiar os dados do filme na criacao.
  exports: [CatalogService],
})
export class CatalogModule {}
