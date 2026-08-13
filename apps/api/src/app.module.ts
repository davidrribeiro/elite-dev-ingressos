import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'node:path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ClockModule } from './common/clock/clock.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // .env unico na raiz do monorepo, o mesmo que o docker-compose usa.
      // Nos testes e2e, o setup-e2e.ts ja carregou o .env.test com override.
      envFilePath: join(__dirname, '..', '..', '..', '.env'),
    }),
    ClockModule,
    PrismaModule,
    // Modulos de dominio entram aqui: AuthModule, CatalogModule,
    // EventsModule, ReservationsModule, TicketsModule, GateModule.
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
