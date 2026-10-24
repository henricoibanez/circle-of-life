import { Body, Controller, Get, HttpCode, Module, NotFoundException, Post, Res } from '@nestjs/common';
import { IsString } from 'class-validator';
import type { Response } from 'express';
import { SessionModule } from '../auth/auth.module';
import { SessionService } from '../auth/session.service';
import { Public } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

class DevLoginDto {
  @IsString({ message: 'informe o usuário' })
  userId!: string;
}

/**
 * Login de desenvolvimento: entrar como um usuário de teste com um clique.
 * Este módulo SÓ é registrado com NODE_ENV=development (veja app.module.ts):
 * em qualquer outro ambiente estas rotas não existem.
 */
@Controller('auth/dev')
class DevAuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly session: SessionService,
  ) {}

  @Public()
  @Get('users')
  users() {
    return this.prisma.user.findMany({
      where: { isTestUser: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: [{ role: 'desc' }, { name: 'asc' }],
    });
  }

  @Public()
  @Post('login')
  @HttpCode(204)
  async login(@Body() { userId }: DevLoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, isTestUser: true } });
    if (!user) throw new NotFoundException('Usuário de teste não encontrado.');
    await this.session.start(res, user.id);
  }
}

@Module({
  imports: [SessionModule],
  controllers: [DevAuthController],
})
export class DevAuthModule {}
