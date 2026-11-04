import { AREA_IDS, type AreaId, FEED_FILTERS, type FeedFilter, MAX_POST_AREAS, MAX_POST_IMAGES, POST_REF_TYPES, type PostRefType, type Visibility } from '@circle/shared';
import { Body, Controller, Delete, Get, HttpCode, Module, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser, Social } from '../common/decorators';
import type { User } from '../generated/prisma/client';
import { SocialModule } from '../social/social.module';
import { FeedService } from './feed.service';

const VIS = ['publico', 'amigos', 'privado'];

class CreatePostDto {
  @IsOptional() @IsString() @MaxLength(120, { message: 'a conquista pode ter até 120 caracteres' }) title?: string;
  @IsOptional() @IsString() @MaxLength(3000, { message: 'o texto pode ter até 3.000 caracteres' }) text?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(MAX_POST_AREAS, { message: `até ${MAX_POST_AREAS} áreas por post` }) @IsIn(AREA_IDS, { each: true, message: 'área inválida' }) areas?: AreaId[];
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) groupIds?: string[];
  @IsOptional() @IsIn(VIS, { message: 'visibilidade inválida' }) visibility?: Visibility;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(30, { each: true }) tags?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(MAX_POST_IMAGES, { message: `até ${MAX_POST_IMAGES} imagens por post` }) @IsString({ each: true }) mediaIds?: string[];
  @IsOptional() @IsIn(POST_REF_TYPES) refType?: PostRefType;
  @IsOptional() @IsString() refId?: string;
}
class UpdatePostDto {
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(3000) text?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(MAX_POST_AREAS, { message: `até ${MAX_POST_AREAS} áreas por post` }) @IsIn(AREA_IDS, { each: true, message: 'área inválida' }) areas?: AreaId[];
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) groupIds?: string[];
  @IsOptional() @IsIn(VIS, { message: 'visibilidade inválida' }) visibility?: Visibility;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(30, { each: true }) tags?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(MAX_POST_IMAGES, { message: `até ${MAX_POST_IMAGES} imagens por post` }) @IsString({ each: true }) mediaIds?: string[];
}
class CommentBody {
  @IsString() @MinLength(1, { message: 'escreva um comentário' }) @MaxLength(1000, { message: 'o comentário pode ter até 1.000 caracteres' }) text!: string;
}
class FeedQueryDto {
  @IsOptional() @IsIn(FEED_FILTERS) filter?: FeedFilter;
  @IsOptional() @IsIn(AREA_IDS) area?: AreaId;
  @IsOptional() @IsString() author?: string;
  @IsOptional() @IsString() group?: string;
  @IsOptional() @IsString() cursor?: string;
}

@Social()
@Controller()
class FeedController {
  constructor(private readonly feed: FeedService) {}

  @Get('feed')
  list(@CurrentUser() u: User, @Query() q: FeedQueryDto) {
    return this.feed.feed(u, q);
  }
  @Get('posts/:id')
  one(@CurrentUser() u: User, @Param('id') id: string) {
    return this.feed.one(u, id);
  }
  @Post('posts')
  create(@CurrentUser() u: User, @Body() dto: CreatePostDto) {
    return this.feed.create(u, dto);
  }
  @Patch('posts/:id')
  update(@CurrentUser() u: User, @Param('id') id: string, @Body() dto: UpdatePostDto) {
    return this.feed.update(u, id, dto);
  }
  @Delete('posts/:id')
  @HttpCode(204)
  remove(@CurrentUser() u: User, @Param('id') id: string) {
    return this.feed.remove(u, id);
  }
  @Put('posts/:id/like')
  @HttpCode(204)
  like(@CurrentUser() u: User, @Param('id') id: string) {
    return this.feed.like(u, id, true);
  }
  @Delete('posts/:id/like')
  @HttpCode(204)
  unlike(@CurrentUser() u: User, @Param('id') id: string) {
    return this.feed.like(u, id, false);
  }
  @Put('posts/:id/save')
  @HttpCode(204)
  save(@CurrentUser() u: User, @Param('id') id: string) {
    return this.feed.save(u, id, true);
  }
  @Delete('posts/:id/save')
  @HttpCode(204)
  unsave(@CurrentUser() u: User, @Param('id') id: string) {
    return this.feed.save(u, id, false);
  }
  @Get('posts/:id/comments')
  comments(@CurrentUser() u: User, @Param('id') id: string) {
    return this.feed.comments(u, id);
  }
  @Post('posts/:id/comments')
  comment(@CurrentUser() u: User, @Param('id') id: string, @Body() dto: CommentBody) {
    return this.feed.comment(u, id, dto.text);
  }
  @Delete('posts/:id/comments/:commentId')
  @HttpCode(204)
  removeComment(@CurrentUser() u: User, @Param('id') id: string, @Param('commentId') commentId: string) {
    return this.feed.removeComment(u, id, commentId);
  }
}

@Module({ imports: [SocialModule], controllers: [FeedController], providers: [FeedService], exports: [FeedService] })
export class FeedModule {}
