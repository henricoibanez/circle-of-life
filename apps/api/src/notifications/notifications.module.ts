import { Body, Controller, Delete, Get, Global, Headers, HttpCode, Module, Param, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsString, IsUrl, ValidateNested } from 'class-validator';
import { CurrentUser } from '../common/decorators';
import type { User } from '../generated/prisma/client';
import { NotificationsService } from './notifications.service';

class PushKeys {
  @IsString() p256dh!: string;
  @IsString() auth!: string;
}
class SubscribeDto {
  @IsUrl({ require_tld: false }, { message: 'endereço de push inválido' }) endpoint!: string;
  @ValidateNested() @Type(() => PushKeys) keys!: PushKeys;
}
class UnsubscribeDto {
  @IsString() endpoint!: string;
}

@Controller()
class NotificationsController {
  constructor(private readonly n: NotificationsService) {}

  @Get('notifications')
  list(@CurrentUser() u: User) {
    return this.n.list(u.id);
  }
  @Get('notifications/unread-count')
  async unread(@CurrentUser() u: User) {
    return { count: await this.n.unreadCount(u.id) };
  }
  @Post('notifications/read-all')
  @HttpCode(204)
  readAll(@CurrentUser() u: User) {
    return this.n.readAll(u.id);
  }
  @Post('notifications/:id/read')
  @HttpCode(204)
  read(@CurrentUser() u: User, @Param('id') id: string) {
    return this.n.setRead(u.id, id, true);
  }
  @Post('notifications/:id/unread')
  @HttpCode(204)
  unreadOne(@CurrentUser() u: User, @Param('id') id: string) {
    return this.n.setRead(u.id, id, false);
  }
  @Delete('notifications/:id')
  @HttpCode(204)
  remove(@CurrentUser() u: User, @Param('id') id: string) {
    return this.n.remove(u.id, id);
  }
  @Delete('notifications')
  @HttpCode(204)
  clear(@CurrentUser() u: User) {
    return this.n.clear(u.id);
  }

  /** Chave pública para o navegador assinar as notificações no celular (null = desligado). */
  @Get('push/public-key')
  key() {
    return { key: this.n.publicKey };
  }
  @Post('push/subscriptions')
  @HttpCode(204)
  subscribe(@CurrentUser() u: User, @Body() dto: SubscribeDto, @Headers('user-agent') ua?: string) {
    return this.n.subscribe(u.id, dto, ua?.slice(0, 300));
  }
  @Post('push/subscriptions/remove')
  @HttpCode(204)
  unsubscribe(@CurrentUser() u: User, @Body() dto: UnsubscribeDto) {
    return this.n.unsubscribe(u.id, dto.endpoint);
  }
}

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
