import { ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { User } from '../generated/prisma/client';
import { ADMIN_ONLY, IS_PUBLIC } from '../common/decorators';

/**
 * Guarda global: toda rota exige login, exceto as marcadas com @Public().
 * Rotas com @AdminOnly() exigem também que o usuário seja administrador.
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
    return true;
  }

  handleRequest<T>(err: unknown, user: T): T {
    if (err || !user) throw new UnauthorizedException('Você precisa entrar para continuar.');
    return user;
  }
}
