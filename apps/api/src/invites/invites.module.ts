import { Body, Controller, Delete, Get, HttpCode, Module, Param, Post } from '@nestjs/common';
import { IsEmail } from 'class-validator';
import { AdminOnly, CurrentUser, Public } from '../common/decorators';
import type { User } from '../generated/prisma/client';
import { InvitesService } from './invites.service';

class CreateInviteDto {
  @IsEmail({}, { message: 'informe um e-mail válido' })
  email!: string;
}

@Controller('invites')
class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @AdminOnly()
  @Get()
  list() {
    return this.invites.list();
  }

  @AdminOnly()
  @Post()
  create(@Body() { email }: CreateInviteDto, @CurrentUser() admin: User) {
    return this.invites.create(email, admin);
  }

  @AdminOnly()
  @Post(':id/resend')
  @HttpCode(204)
  resend(@Param('id') id: string, @CurrentUser() admin: User) {
    return this.invites.resend(id, admin);
  }

  @AdminOnly()
  @Delete(':id')
  @HttpCode(204)
  cancel(@Param('id') id: string) {
    return this.invites.cancel(id);
  }

  /** Público: a tela do convite mostra para qual e-mail ele é. */
  @Public()
  @Get('check/:token')
  check(@Param('token') token: string) {
    return this.invites.check(token);
  }
}

@Module({
  controllers: [InvitesController],
  providers: [InvitesService],
})
export class InvitesModule {}
