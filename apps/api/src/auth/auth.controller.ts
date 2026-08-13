import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
// `import type`: com isolatedModules + emitDecoratorMetadata, um tipo usado em
// assinatura decorada precisa ser importado assim, senao o TS tenta emitir o
// valor de uma interface que nao existe em runtime.
import type { AuthenticatedUser } from './auth.types';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Public } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(200) // login nao cria recurso; 201 seria mentira
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user);
  }
}
