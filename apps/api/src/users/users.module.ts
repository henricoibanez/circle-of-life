import { Controller, Get, Module } from '@nestjs/common';
import { CurrentUser } from '../common/decorators';
import type { User } from '../generated/prisma/client';

/** O que o app recebe sobre a pessoa logada. */
export function toMe(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    handle: user.handle,
    bio: user.bio,
    role: user.role,
    photoUrl: null as string | null, // foto entra na etapa 7 (storage)
    googleConnected: Boolean(user.googleId),
    preferences: {
      palette: user.palette,
      randomTheme: user.randomTheme,
      themeMode: user.themeMode,
      defaultPostVisibility: user.defaultPostVisibility,
    },
    xp: { total: user.xpTotal, disponivel: Math.max(0, user.xpTotal - user.xpSpent) },
  };
}

@Controller('me')
class MeController {
  /** Dados da pessoa logada. */
  @Get()
  me(@CurrentUser() user: User) {
    return toMe(user);
  }
}

@Module({ controllers: [MeController] })
export class UsersModule {}
