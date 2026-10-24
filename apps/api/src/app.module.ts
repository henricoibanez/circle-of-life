import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [AppConfigModule, PrismaModule, StorageModule],
  controllers: [HealthController],
})
export class AppModule {}
