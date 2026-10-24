import { Body, Controller, Get, Injectable, Module, Put } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import sanitizeHtml from 'sanitize-html';
import { CurrentUser } from '../common/decorators';
import type { User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../xp/activity.service';

class SaveDto {
  @IsString() @MaxLength(200_000, { message: 'o texto ficou grande demais' }) html!: string;
}

/**
 * Só a formatação que o editor oferece passa: títulos, parágrafos, negrito,
 * itálico, sublinhado, cor de destaque, listas e alinhamento. Qualquer outra
 * coisa (scripts, links, imagens externas…) é removida antes de salvar.
 */
export function cleanNecroHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ['h1', 'h2', 'p', 'div', 'br', 'b', 'strong', 'i', 'em', 'u', 'span', 'font', 'ul', 'ol', 'li'],
    allowedAttributes: { span: ['style'], font: ['color'], p: ['style'], div: ['style'], h1: ['style'], h2: ['style'], li: ['style'] },
    allowedStyles: {
      '*': {
        color: [/^#[0-9a-f]{3,6}$/i, /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/],
        'text-align': [/^(left|right|center|justify)$/],
      },
    },
  });
}

@Injectable()
export class NecrologioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  async get(userId: string) {
    const n = await this.prisma.necrologio.findUnique({ where: { userId } });
    return { html: n?.html ?? '', updatedAt: n?.updatedAt.toISOString() ?? null };
  }

  /** Salvamento automático do editor. Registra na atividade recente no máximo uma vez por hora. */
  async save(userId: string, html: string) {
    const clean = cleanNecroHtml(html);
    const before = await this.prisma.necrologio.findUnique({ where: { userId } });
    const n = await this.prisma.necrologio.upsert({ where: { userId }, create: { userId, html: clean }, update: { html: clean } });
    if (!before || Date.now() - before.updatedAt.getTime() > 3600_000) {
      await this.activity.add(this.prisma, userId, 'feather', 'Você escreveu no seu necrológio', '/necrologio');
    }
    return { html: n.html, updatedAt: n.updatedAt.toISOString() };
  }
}

@Controller('necrologio')
class NecrologioController {
  constructor(private readonly necro: NecrologioService) {}

  @Get()
  get(@CurrentUser() u: User) {
    return this.necro.get(u.id);
  }

  @Put()
  save(@CurrentUser() u: User, @Body() dto: SaveDto) {
    return this.necro.save(u.id, dto.html);
  }
}

@Module({ controllers: [NecrologioController], providers: [NecrologioService], exports: [NecrologioService] })
export class NecrologioModule {}
