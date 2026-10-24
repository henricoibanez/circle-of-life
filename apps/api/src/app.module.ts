import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { HealthController } from './health/health.controller';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [AppConfigModule, StorageModule],
  controllers: [HealthController],
})
export class AppModule {}
