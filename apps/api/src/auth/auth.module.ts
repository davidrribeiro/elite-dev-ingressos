import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { SignOptions } from 'jsonwebtoken';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      // global: o JwtAuthGuard e registrado no AppModule e precisa do JwtService
      // sem que cada modulo de dominio tenha de reimportar este aqui.
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          // O cast e necessario porque o tipo de expiresIn e um template
          // literal ("7d", "1h", ...), e o valor vem do .env como string
          // qualquer. A validacao real acontece no jsonwebtoken, em runtime.
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ??
            '7d') as SignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
