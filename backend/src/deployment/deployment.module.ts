import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';

import { DeploymentController } from './deployment.controller';
import { DeploymentService } from './deployment.service';
import { LogsController } from './logs.controller';
import { Deployment } from './entities/deployment.entity';
import { LoggingService } from '../common/logging.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Deployment]),
    BullModule.registerQueue({
      name: 'deployment',
    }),
  ],
  controllers: [DeploymentController, LogsController],
  providers: [DeploymentService, LoggingService],
  exports: [DeploymentService, LoggingService],
})
export class DeploymentModule {}