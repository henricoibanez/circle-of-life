import { Module } from '@nestjs/common';
import { ConditionalModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { AppConfigModule } from './config/config.module';
import { DevAuthModule } from './dev-auth/dev-auth.module';
import { HealthController } from './health/health.controller';
import { InvitesModule } from './invites/invites.module';
import { MailModule } from './mail/mail.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    StorageModule,
    MailModule,
    AuthModule,
    // Login de teste: só existe em desenvolvimento.
    ConditionalModule.registerWhen(DevAuthModule, env => env.NODE_ENV === 'development'),
    UsersModule,
    InvitesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
