import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { DeploymentWorker } from './deployment.worker';
import { StackDetectionService } from './stack-detection.service';
import { ContainerService } from './container.service';
import { ProjectAnalysisService } from './project-analysis.service';
import { ProviderModule } from '../provider/provider.module';
import { DeploymentModule } from '../deployment/deployment.module';
import { AuthModule } from '../auth/auth.module';
import { LoggingService } from '../common/logging.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'deployment',
    }),
    ProviderModule,
    DeploymentModule,
    AuthModule,
  ],
  providers: [
    DeploymentWorker,
    StackDetectionService,
    ContainerService,
    ProjectAnalysisService,
    LoggingService,
  ],
  exports: [
    StackDetectionService,
    ContainerService,
    ProjectAnalysisService,
    LoggingService,
  ],
})
export class WorkerModule {}
