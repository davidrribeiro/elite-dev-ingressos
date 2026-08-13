import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AppError, ErrorCode } from '../common/errors/app-error';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser, JwtPayload, PublicUser } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(
    dto: RegisterDto,
  ): Promise<{ token: string; user: PublicUser }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });

    if (existing) {
      throw new AppError(
        ErrorCode.EMAIL_ALREADY_USED,
        'Ja existe uma conta com este e-mail.',
        409,
      );
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        role: Role.CUSTOMER,
      },
      select: { id: true, email: true, name: true, role: true },
    });

    return { token: this.sign(user), user };
  }

  async login(dto: LoginDto): Promise<{ token: string; user: PublicUser }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Mesma resposta para e-mail inexistente e senha errada: distinguir os dois
    // casos entrega uma lista de e-mails cadastrados a quem tentar.
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new AppError(
        ErrorCode.INVALID_CREDENTIALS,
        'E-mail ou senha incorretos.',
        401,
      );
    }

    const publicUser: PublicUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    return { token: this.sign(publicUser), user: publicUser };
  }

  async me(user: AuthenticatedUser): Promise<PublicUser> {
    const found = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!found) {
      throw AppError.notFound('Usuario');
    }

    return found;
  }

  private sign(user: Pick<PublicUser, 'id' | 'email' | 'role'>): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return this.jwt.sign(payload);
  }
}
