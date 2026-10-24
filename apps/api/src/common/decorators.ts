import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '../generated/prisma/client';

export const IS_PUBLIC = 'isPublic';
export const ADMIN_ONLY = 'adminOnly';

/** Rota aberta: não exige login (ex.: health check, tela de convite). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Rota só para administradores. */
export const AdminOnly = () => SetMetadata(ADMIN_ONLY, true);

/** Usuário logado que fez o pedido: `@CurrentUser() user: User`. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): User => {
  return ctx.switchToHttp().getRequest<Request>().user as User;
});
