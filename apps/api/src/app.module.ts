import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { join } from 'node:path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
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
    AuthModule,
    // Entram nas proximas fatias: CatalogModule, EventsModule,
    // ReservationsModule, PaymentsModule, TicketsModule, GateModule.
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Autenticacao por padrao: rota sem @Public() exige token. O contrario —
    // proteger rota a rota — deixa a proxima rota nova desprotegida por
    // esquecimento, e esquecer e o caso comum.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Roda depois do JwtAuthGuard e so age onde ha @Roles().
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
