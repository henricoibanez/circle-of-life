import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { calendarAskDue } from '@circle/shared';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../config/env';
import type { Task, User } from '../generated/prisma/client';
import { isGoogleConfigured } from '../auth/google.strategy';
import { PrismaService } from '../prisma/prisma.service';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
/** Só o permissão de criar/editar eventos — nada mais da conta Google. */
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';

const dayStr = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

/**
 * Integração com a Google Agenda da pessoa (opcional, conectada nas Configurações).
 * Guardamos só o token de atualização (refresh token) para criar eventos depois;
 * usamos os endpoints padrão do Google (OAuth e Calendar API), sem SDK específico.
 */
@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly jwt: JwtService,
  ) {}

  get available() {
    return isGoogleConfigured(this.config);
  }

  connected(user: User) {
    return Boolean(user.googleCalendarToken);
  }

  /** Sugerir conectar a agenda ao pôr um prazo: Google configurado, agenda não conectada e sem "Agora não" recente. */
  askConnect(user: User, now = new Date()) {
    return this.available && !this.connected(user) && calendarAskDue(user.calendarAskedAt, now);
  }

  /** "Agora não" na sugestão de conectar a agenda: só sugere de novo depois de CALENDAR_ASK_AGAIN_DAYS dias. */
  async dismissAsk(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { calendarAskedAt: new Date() } });
  }

  private get redirectUri() {
    return `${this.config.get('WEB_URL')}/api/calendar/google/callback`;
  }

  /** Página do Google onde a pessoa autoriza o acesso à agenda. */
  async authUrl(user: User) {
    if (!this.available) throw new BadRequestException('O Google não está configurado neste ambiente.');
    const state = await this.jwt.signAsync({ sub: user.id, calendar: true }, { expiresIn: '10m' });
    const params = new URLSearchParams({
      client_id: this.config.get('GOOGLE_CLIENT_ID'),
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: SCOPE,
      access_type: 'offline', // para receber o refresh token
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  /** Volta do Google: confere o state (quem iniciou), troca o code por tokens e guarda o refresh token. */
  async handleCallback(code: string, state: string) {
    let userId: string;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; calendar?: boolean }>(state);
      if (!payload.calendar || !payload.sub) throw new Error('state inválido');
      userId = payload.sub;
    } catch {
      throw new ForbiddenException('A conexão expirou ou foi interrompida. Tente de novo.');
    }
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.config.get('GOOGLE_CLIENT_ID'),
        client_secret: this.config.get('GOOGLE_CLIENT_SECRET'),
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const data = (await res.json()) as { refresh_token?: string; error?: string };
    if (!res.ok || !data.refresh_token) {
      this.logger.warn(`Falha ao conectar a agenda: ${data.error ?? res.status}`);
      throw new BadRequestException('Não foi possível conectar a Google Agenda. Tente de novo.');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { googleCalendarToken: data.refresh_token } });
  }

  /** Desconecta: revoga o acesso no Google e apaga o token guardado. */
  async disconnect(user: User) {
    if (user.googleCalendarToken) {
      await fetch(`${REVOKE_URL}?token=${encodeURIComponent(user.googleCalendarToken)}`, { method: 'POST' }).catch(() => undefined);
      await this.prisma.user.update({ where: { id: user.id }, data: { googleCalendarToken: null } });
    }
  }

  /** Token de acesso novo a partir do refresh token guardado. */
  private async accessToken(user: User) {
    const refresh = user.googleCalendarToken;
    if (!refresh) throw new BadRequestException('Conecte a sua Google Agenda nas Configurações.');
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refresh,
        client_id: this.config.get('GOOGLE_CLIENT_ID'),
        client_secret: this.config.get('GOOGLE_CLIENT_SECRET'),
        grant_type: 'refresh_token',
      }),
    });
    const data = (await res.json()) as { access_token?: string; error?: string };
    if (!res.ok || !data.access_token) {
      // Token revogado/expirado: marca como desconectada para a pessoa reconectar.
      if (res.status === 400 || res.status === 401) await this.prisma.user.update({ where: { id: user.id }, data: { googleCalendarToken: null } });
      throw new BadRequestException('A conexão com a Google Agenda caiu. Reconecte nas Configurações.');
    }
    return data.access_token;
  }

  private body(task: Task) {
    const start = task.dueDate!;
    return JSON.stringify({
      summary: task.title,
      description: task.description || undefined,
      start: { date: dayStr(start) }, // evento de dia inteiro
      end: { date: dayStr(addDays(start, 1)) }, // o fim é exclusivo (dia seguinte)
    });
  }

  /** Cria (ou atualiza, se já existir) o evento da tarefa na agenda. Devolve o id do evento. */
  async upsertEvent(user: User, task: Task): Promise<string> {
    if (!task.dueDate) throw new BadRequestException('Defina uma data na tarefa para colocá-la na agenda.');
    const token = await this.accessToken(user);
    const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

    if (task.calendarEventId) {
      const res = await fetch(`${EVENTS_URL}/${task.calendarEventId}`, { method: 'PATCH', headers, body: this.body(task) });
      if (res.ok) return task.calendarEventId;
      if (res.status !== 404 && res.status !== 410) throw new BadRequestException('Não foi possível atualizar o evento na agenda.');
      // O evento foi apagado direto na agenda: cria um novo.
    }
    const res = await fetch(EVENTS_URL, { method: 'POST', headers, body: this.body(task) });
    const data = (await res.json()) as { id?: string };
    if (!res.ok || !data.id) throw new BadRequestException('Não foi possível criar o evento na agenda.');
    return data.id;
  }

  /** Remove o evento da tarefa da agenda (ignora se já não existe). */
  async removeEvent(user: User, task: Task) {
    if (!task.calendarEventId || !user.googleCalendarToken) return;
    const token = await this.accessToken(user).catch(() => null);
    if (!token) return;
    await fetch(`${EVENTS_URL}/${task.calendarEventId}`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } }).catch(() => undefined);
  }
}
