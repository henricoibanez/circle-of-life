import { AREA_IDS, type AreaId, REACTION_IDS, type ReactionKind, STORY_CAPTION_MAX, STORY_MAX_AREAS, type Visibility } from '@circle/shared';
import { Body, Controller, Delete, Get, HttpCode, Module, Param, Post, Put } from '@nestjs/common';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { CurrentUser, Social } from '../common/decorators';
import type { User } from '../generated/prisma/client';
import { SocialModule } from '../social/social.module';
import { StoriesService } from './stories.service';

class ReactionDto {
  @IsOptional() @IsIn(REACTION_IDS, { message: 'reação inválida' }) kind?: ReactionKind;
}
class CreateStoryDto {
  @IsString() fileId!: string;
  @IsArray()
  @ArrayMinSize(1, { message: 'escolha pelo menos 1 área' })
  @ArrayMaxSize(STORY_MAX_AREAS, { message: `escolha até ${STORY_MAX_AREAS} áreas` })
  @IsIn(AREA_IDS, { each: true, message: 'área inválida' })
  areas!: AreaId[];
  @IsOptional() @IsString() @MaxLength(STORY_CAPTION_MAX, { message: `a legenda pode ter até ${STORY_CAPTION_MAX} caracteres` }) caption?: string;
  @IsOptional() @IsIn(['publico', 'amigos', 'privado'], { message: 'visibilidade inválida' }) visibility?: Visibility;
  /** Vídeo: trecho exibido (início e fim, em segundos). */
  @IsOptional() @IsNumber() @Min(0) clipStart?: number;
  @IsOptional() @IsNumber() @Min(0) clipEnd?: number;
}

@Social()
@Controller('stories')
class StoriesController {
  constructor(private readonly stories: StoriesService) {}

  @Get()
  list(@CurrentUser() u: User) {
    return this.stories.list(u);
  }
  @Post()
  create(@CurrentUser() u: User, @Body() dto: CreateStoryDto) {
    return this.stories.create(u, dto);
  }
  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() u: User, @Param('id') id: string) {
    return this.stories.remove(u, id);
  }
  @Post(':id/view')
  @HttpCode(204)
  view(@CurrentUser() u: User, @Param('id') id: string) {
    return this.stories.view(u, id);
  }
  @Put(':id/like')
  @HttpCode(204)
  like(@CurrentUser() u: User, @Param('id') id: string, @Body() dto: ReactionDto) {
    return this.stories.like(u, id, true, dto?.kind ?? 'like');
  }
  @Delete(':id/like')
  @HttpCode(204)
  unlike(@CurrentUser() u: User, @Param('id') id: string) {
    return this.stories.like(u, id, false);
  }
  @Get(':id/viewers')
  viewers(@CurrentUser() u: User, @Param('id') id: string) {
    return this.stories.viewers(u, id);
  }
}

@Module({ imports: [SocialModule], controllers: [StoriesController], providers: [StoriesService], exports: [StoriesService] })
export class StoriesModule {}
