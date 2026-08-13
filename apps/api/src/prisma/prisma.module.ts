import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Global para os modulos de dominio nao precisarem importar a cada vez.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
