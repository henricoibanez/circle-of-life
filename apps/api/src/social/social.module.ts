import { AREA_IDS, type AreaId } from '@circle/shared';
import { Body, Controller, Delete, Get, HttpCode, Module, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { CurrentUser, Social } from '../common/decorators';
import type { User } from '../generated/prisma/client';
import { TrilhasModule } from '../trilhas/trilhas.module';
import { ForumService } from './forum.service';
import { FriendsService } from './friends.service';
import { GroupsService } from './groups.service';
import { PeopleService } from './people.service';
import { ProfileService } from './profile.service';

class FriendRequestDto {
  @IsString() @MinLength(2, { message: 'digite o e-mail ou o @ID da pessoa' }) @MaxLength(200) who!: string;
}
class GroupDto {
  @IsString() @MinLength(3, { message: 'o nome precisa ter pelo menos 3 caracteres' }) @MaxLength(60, { message: 'o nome pode ter até 60 caracteres' }) name!: string;
  @IsString() @MaxLength(300, { message: 'a descrição pode ter até 300 caracteres' }) description!: string;
  @IsIn(AREA_IDS, { message: 'área inválida' }) area!: AreaId;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() coverFileId?: string | null;
  @IsOptional() @IsBoolean() private?: boolean;
}
class GroupPatchDto {
  @IsOptional() @IsString() @MinLength(3, { message: 'o nome precisa ter pelo menos 3 caracteres' }) @MaxLength(60, { message: 'o nome pode ter até 60 caracteres' }) name?: string;
  @IsOptional() @IsString() @MaxLength(300, { message: 'a descrição pode ter até 300 caracteres' }) description?: string;
  @IsOptional() @IsIn(AREA_IDS, { message: 'área inválida' }) area?: AreaId;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() coverFileId?: string | null;
  @IsOptional() @IsBoolean() private?: boolean;
}
class TopicBody {
  @IsString() @MinLength(3, { message: 'o título precisa ter pelo menos 3 caracteres' }) @MaxLength(120, { message: 'o título pode ter até 120 caracteres' }) title!: string;
  @IsOptional() @IsString() @MaxLength(3000, { message: 'o texto pode ter até 3.000 caracteres' }) text?: string;
}
class ReplyBody {
  @IsString() @MinLength(1, { message: 'escreva a resposta' }) @MaxLength(2000, { message: 'a resposta pode ter até 2.000 caracteres' }) text!: string;
}
class GroupTrilhaDto {
  @IsString() trilhaId!: string;
}
class RejectDto {
  @IsOptional() @IsString() @MaxLength(300, { message: 'o motivo pode ter até 300 caracteres' }) reason?: string;
}
class InviteDto {
  @IsString() userId!: string;
}
class MemberRoleDto {
  @IsIn(['admin', 'member'], { message: 'papel inválido' }) role!: 'admin' | 'member';
}

@Social()
@Controller('friends')
class FriendsController {
  constructor(private readonly friends: FriendsService) {}

  @Get()
  list(@CurrentUser() u: User) {
    return this.friends.list(u.id);
  }
  @Get('search')
  search(@CurrentUser() u: User, @Query('q') q = '') {
    return this.friends.search(u, q.slice(0, 60));
  }
  @Post('requests')
  request(@CurrentUser() u: User, @Body() dto: FriendRequestDto) {
    return this.friends.request(u, dto.who);
  }
  @Post('requests/:id/accept')
  accept(@CurrentUser() u: User, @Param('id') id: string) {
    return this.friends.accept(u, id);
  }
  @Delete('requests/:id')
  @HttpCode(204)
  dismiss(@CurrentUser() u: User, @Param('id') id: string) {
    return this.friends.dismiss(u, id);
  }
  @Delete(':userId')
  @HttpCode(204)
  remove(@CurrentUser() u: User, @Param('userId') id: string) {
    return this.friends.remove(u, id);
  }
}

@Social()
@Controller('groups')
class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  list(@CurrentUser() u: User) {
    return this.groups.list(u.id);
  }
  @Get(':id')
  detail(@CurrentUser() u: User, @Param('id') id: string) {
    return this.groups.detail(u, id);
  }
  @Post()
  create(@CurrentUser() u: User, @Body() dto: GroupDto) {
    return this.groups.create(u, dto);
  }
  @Patch(':id')
  update(@CurrentUser() u: User, @Param('id') id: string, @Body() dto: GroupPatchDto) {
    return this.groups.update(u, id, dto);
  }
  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() u: User, @Param('id') id: string) {
    return this.groups.remove(u, id);
  }
  @Post(':id/join')
  join(@CurrentUser() u: User, @Param('id') id: string) {
    return this.groups.join(u, id);
  }
  @Delete(':id/membership')
  @HttpCode(204)
  leave(@CurrentUser() u: User, @Param('id') id: string) {
    return this.groups.leave(u, id);
  }
  @Post(':id/trilhas')
  addTrilha(@CurrentUser() u: User, @Param('id') id: string, @Body() dto: GroupTrilhaDto) {
    return this.groups.addTrilha(u, id, dto.trilhaId);
  }
  @Delete(':id/trilhas/:trilhaId')
  removeTrilha(@CurrentUser() u: User, @Param('id') id: string, @Param('trilhaId') trilhaId: string) {
    return this.groups.removeTrilha(u, id, trilhaId);
  }
  /** Tornar gestor (role "admin") ou membro comum. */
  @Put(':id/members/:userId/role')
  setRole(@CurrentUser() u: User, @Param('id') id: string, @Param('userId') userId: string, @Body() dto: MemberRoleDto) {
    return this.groups.setRole(u, id, userId, dto.role);
  }
  /** Remover do grupo (pode voltar). */
  @Delete(':id/members/:userId')
  removeMember(@CurrentUser() u: User, @Param('id') id: string, @Param('userId') userId: string) {
    return this.groups.removeMember(u, id, userId);
  }
  /** Banir (não volta até desbanir). */
  @Post(':id/members/:userId/ban')
  banMember(@CurrentUser() u: User, @Param('id') id: string, @Param('userId') userId: string) {
    return this.groups.banMember(u, id, userId);
  }
  /** Desbanir. */
  @Delete(':id/bans/:userId')
  unban(@CurrentUser() u: User, @Param('id') id: string, @Param('userId') userId: string) {
    return this.groups.unban(u, id, userId);
  }
  /** Cancelar o meu pedido para entrar ou recusar o convite que recebi. */
  @Delete(':id/request')
  cancelRequest(@CurrentUser() u: User, @Param('id') id: string) {
    return this.groups.cancelRequest(u, id);
  }
  /** Gestor: aprovar um pedido para entrar. */
  @Post(':id/requests/:userId/approve')
  approve(@CurrentUser() u: User, @Param('id') id: string, @Param('userId') userId: string) {
    return this.groups.approve(u, id, userId);
  }
  /** Gestor: recusar um pedido, com motivo opcional. */
  @Post(':id/requests/:userId/reject')
  reject(@CurrentUser() u: User, @Param('id') id: string, @Param('userId') userId: string, @Body() dto: RejectDto) {
    return this.groups.reject(u, id, userId, dto.reason);
  }
  /** Gestor: buscar pessoas para convidar. */
  @Get(':id/invite-search')
  inviteSearch(@CurrentUser() u: User, @Param('id') id: string, @Query('q') q = '') {
    return this.groups.inviteSearch(u, id, q.slice(0, 60));
  }
  /** Gestor: convidar alguém. */
  @Post(':id/invites')
  invite(@CurrentUser() u: User, @Param('id') id: string, @Body() dto: InviteDto) {
    return this.groups.invite(u, id, dto.userId);
  }
  /** Gestor: cancelar um convite. */
  @Delete(':id/invites/:userId')
  cancelInvite(@CurrentUser() u: User, @Param('id') id: string, @Param('userId') userId: string) {
    return this.groups.cancelInvite(u, id, userId);
  }
}

/** Fórum do grupo: tópicos e respostas, só para membros. */
@Social()
@Controller('groups/:id/topics')
class ForumController {
  constructor(private readonly forum: ForumService) {}

  @Get()
  list(@CurrentUser() u: User, @Param('id') id: string) {
    return this.forum.list(u, id);
  }
  @Post()
  create(@CurrentUser() u: User, @Param('id') id: string, @Body() dto: TopicBody) {
    return this.forum.create(u, id, dto);
  }
  @Get(':topicId')
  detail(@CurrentUser() u: User, @Param('id') id: string, @Param('topicId') topicId: string) {
    return this.forum.detail(u, id, topicId);
  }
  @Post(':topicId/replies')
  reply(@CurrentUser() u: User, @Param('id') id: string, @Param('topicId') topicId: string, @Body() dto: ReplyBody) {
    return this.forum.reply(u, id, topicId, dto.text);
  }
  @Delete(':topicId')
  @HttpCode(204)
  removeTopic(@CurrentUser() u: User, @Param('id') id: string, @Param('topicId') topicId: string) {
    return this.forum.removeTopic(u, id, topicId);
  }
  @Delete(':topicId/replies/:replyId')
  removeReply(@CurrentUser() u: User, @Param('id') id: string, @Param('topicId') topicId: string, @Param('replyId') replyId: string) {
    return this.forum.removeReply(u, id, topicId, replyId);
  }
}

@Social()
@Controller('people')
class PeopleController {
  constructor(private readonly profile: ProfileService) {}

  /** Mini-perfil mostrado ao tocar na foto de alguém. */
  @Get(':id')
  get(@CurrentUser() u: User, @Param('id') id: string) {
    return this.profile.profile(u, id);
  }
  @Post(':id/block')
  block(@CurrentUser() u: User, @Param('id') id: string) {
    return this.profile.block(u, id);
  }
  @Delete(':id/block')
  unblock(@CurrentUser() u: User, @Param('id') id: string) {
    return this.profile.unblock(u, id);
  }
}

@Module({
  imports: [TrilhasModule],
  controllers: [FriendsController, GroupsController, ForumController, PeopleController],
  providers: [PeopleService, FriendsService, GroupsService, ForumService, ProfileService],
  exports: [PeopleService, FriendsService, GroupsService],
})
export class SocialModule {}
