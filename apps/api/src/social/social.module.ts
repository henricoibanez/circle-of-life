import { AREA_IDS, type AreaId } from '@circle/shared';
import { Body, Controller, Delete, Get, HttpCode, Module, Param, Patch, Post } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { CurrentUser } from '../common/decorators';
import type { User } from '../generated/prisma/client';
import { TrilhasModule } from '../trilhas/trilhas.module';
import { FriendsService } from './friends.service';
import { GroupsService } from './groups.service';
import { PeopleService } from './people.service';

class FriendRequestDto {
  @IsString() @MinLength(2, { message: 'digite o e-mail ou o @ID da pessoa' }) @MaxLength(200) who!: string;
}
class GroupDto {
  @IsString() @MinLength(3, { message: 'o nome precisa ter pelo menos 3 caracteres' }) @MaxLength(60, { message: 'o nome pode ter até 60 caracteres' }) name!: string;
  @IsString() @MaxLength(300, { message: 'a descrição pode ter até 300 caracteres' }) description!: string;
  @IsIn(AREA_IDS, { message: 'área inválida' }) area!: AreaId;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() coverFileId?: string | null;
}
class GroupPatchDto {
  @IsOptional() @IsString() @MinLength(3, { message: 'o nome precisa ter pelo menos 3 caracteres' }) @MaxLength(60, { message: 'o nome pode ter até 60 caracteres' }) name?: string;
  @IsOptional() @IsString() @MaxLength(300, { message: 'a descrição pode ter até 300 caracteres' }) description?: string;
  @IsOptional() @IsIn(AREA_IDS, { message: 'área inválida' }) area?: AreaId;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() coverFileId?: string | null;
}
class GroupTrilhaDto {
  @IsString() trilhaId!: string;
}

@Controller('friends')
class FriendsController {
  constructor(private readonly friends: FriendsService) {}

  @Get()
  list(@CurrentUser() u: User) {
    return this.friends.list(u.id);
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
}

@Module({
  imports: [TrilhasModule],
  controllers: [FriendsController, GroupsController],
  providers: [PeopleService, FriendsService, GroupsService],
  exports: [PeopleService, FriendsService, GroupsService],
})
export class SocialModule {}
