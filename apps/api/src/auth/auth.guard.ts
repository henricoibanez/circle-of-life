import { ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { User } from '../generated/prisma/client';
import { SOCIAL_LOCKED_MESSAGE, socialStatus } from '@circle/shared';
import { ADMIN_ONLY, IS_PUBLIC, SOCIAL } from '../common/decorators';

/**
 * Guarda global: toda rota exige login, exceto as marcadas com @Public().
 * Rotas com @AdminOnly() exigem também que o usuário seja administrador.
 * Rotas com @Social() exigem a rede social aberta (Jornada de primeiro acesso).
 */
@Injectable()
export class SessionGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    await super.canActivate(context);

    if (this.reflector.getAllAndOverride<boolean>(ADMIN_ONLY, targets)) {
      const user = context.switchToHttp().getRequest<{ user: User }>().user;
      if (user.role !== 'admin') throw new ForbiddenException('Só administradores podem fazer isso.');
    }
    if (this.reflector.getAllAndOverride<boolean>(SOCIAL, targets)) {
      const user = context.switchToHttp().getRequest<{ user: User }>().user;
      if (!socialStatus(user).open) throw new ForbiddenException(SOCIAL_LOCKED_MESSAGE);
    }
    return true;
  }

  handleRequest<T>(err: unknown, user: T): T {
    if (err || !user) throw new UnauthorizedException('Você precisa entrar para continuar.');
    return user;
  }
}
