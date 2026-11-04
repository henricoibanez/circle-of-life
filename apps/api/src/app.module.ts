import { Module } from '@nestjs/common';
import { ConditionalModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AnalysisModule } from './analysis/analysis.module';
import { AuthModule } from './auth/auth.module';
import { CalendarModule } from './calendar/calendar.module';
import { BacklogModule } from './backlog/backlog.module';
import { AppConfigModule } from './config/config.module';
import { CronModule } from './cron/cron.module';
import { DevAuthModule } from './dev-auth/dev-auth.module';
import { DreamsModule } from './exercises/dreams.module';
import { MaslowModule } from './exercises/maslow.module';
import { NecrologioModule } from './exercises/necrologio.module';
import { RodaModule } from './exercises/roda.module';
import { FeedModule } from './feed/feed.module';
import { HealthController } from './health/health.controller';
import { InvitesModule } from './invites/invites.module';
import { JourneyModule } from './journey/journey.module';
import { MailModule } from './mail/mail.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { SocialModule } from './social/social.module';
import { StoriesModule } from './stories/stories.module';
import { StorageModule } from './storage/storage.module';
import { TrilhasModule } from './trilhas/trilhas.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';
import { XpModule } from './xp/xp.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    StorageModule,
    MailModule,
    XpModule,
    JourneyModule,
    // Tarefas agendadas (ex.: aviso de atrasadas). Desligadas nos testes automáticos.
    ...(process.env.DISABLE_SCHEDULE === 'true' ? [] : [ScheduleModule.forRoot()]),
    NotificationsModule,
    UploadsModule,
    AuthModule,
    CalendarModule,
    // Login de teste: só existe em desenvolvimento.
    ConditionalModule.registerWhen(DevAuthModule, env => env.NODE_ENV === 'development', { debug: false }),
    UsersModule,
    InvitesModule,
    BacklogModule,
    RodaModule,
    MaslowModule,
    NecrologioModule,
    DreamsModule,
    TrilhasModule,
    SocialModule,
    FeedModule,
    StoriesModule,
    AnalysisModule,
    CronModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
