import { Module } from '@nestjs/common';
import { ConditionalModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { BacklogModule } from './backlog/backlog.module';
import { AppConfigModule } from './config/config.module';
import { DevAuthModule } from './dev-auth/dev-auth.module';
import { DreamsModule } from './exercises/dreams.module';
import { MaslowModule } from './exercises/maslow.module';
import { NecrologioModule } from './exercises/necrologio.module';
import { RodaModule } from './exercises/roda.module';
import { HealthController } from './health/health.controller';
import { InvitesModule } from './invites/invites.module';
import { MailModule } from './mail/mail.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
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
    UploadsModule,
    AuthModule,
    // Login de teste: só existe em desenvolvimento.
    ConditionalModule.registerWhen(DevAuthModule, env => env.NODE_ENV === 'development', { debug: false }),
    UsersModule,
    InvitesModule,
    BacklogModule,
    RodaModule,
    MaslowModule,
    NecrologioModule,
    DreamsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
