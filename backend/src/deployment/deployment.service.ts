import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { v4 as uuidv4 } from 'uuid';

import { Deployment } from './entities/deployment.entity';
import { CreateDeploymentDto } from './dto/deployment.dto';
import {
  DeploymentStatus,
  LogEvent,
  DeploymentListQuery,
  DeploymentListResponse,
} from '../common/types';

@Injectable()
export class DeploymentService {
  constructor(
    @InjectRepository(Deployment)
    private deploymentRepository: Repository<Deployment>,
    @InjectQueue('deployment')
    private deploymentQueue: Queue,
  ) {}

  async createDeployment(createDeploymentDto: CreateDeploymentDto): Promise<Deployment> {
    const deployment = this.deploymentRepository.create({
      ...createDeploymentDto,
      status: 'queued',
    });

    const savedDeployment = await this.deploymentRepository.save(deployment);

    // Add job to queue
    const job = await this.deploymentQueue.add(
      'process-deployment',
      {
        deploymentId: savedDeployment.id,
        repoUrl: createDeploymentDto.repoUrl,
        branch: createDeploymentDto.branch || 'main',
        environment: createDeploymentDto.environment,
        budget: createDeploymentDto.budget,
        preferProviders: createDeploymentDto.preferProviders,
        provider: (createDeploymentDto as any).provider,
        credentialId: (createDeploymentDto as any).credentialId,
        config: (createDeploymentDto as any).config,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: 10,
        removeOnFail: 10,
      },
    );

    await this.deploymentRepository.update(savedDeployment.id, {
      jobId: job.id.toString(),
    });

    return savedDeployment;
  }

  async getDeploymentStatus(id: string): Promise<DeploymentStatus> {
    const deployment = await this.deploymentRepository.findOne({
      where: { id },
    });

    if (!deployment) {
      throw new NotFoundException(`Deployment ${id} not found`);
    }

    return {
      id: deployment.id,
      status: deployment.status,
      provider: deployment.provider,
      url: deployment.deploymentUrl,
      detected: deployment.detectedStack,
      createdAt: deployment.createdAt,
      updatedAt: deployment.updatedAt,
      error: deployment.errorMessage,
    };
  }

  async getDeploymentLogs(id: string): Promise<LogEvent[]> {
    const deployment = await this.deploymentRepository.findOne({
      where: { id },
      select: ['buildLogs'],
    });

    if (!deployment) {
      throw new NotFoundException(`Deployment ${id} not found`);
    }

    return deployment.buildLogs || [];
  }

  async isDeploymentActive(id: string): Promise<boolean> {
    const deployment = await this.deploymentRepository.findOne({
      where: { id },
      select: ['status'],
    });

    if (!deployment) {
      return false;
    }

    const activeStatuses = ['queued', 'cloning', 'detecting', 'building', 'deploying'];
    return activeStatuses.includes(deployment.status);
  }

  async cancelDeployment(id: string): Promise<void> {
    const deployment = await this.deploymentRepository.findOne({
      where: { id },
    });

    if (!deployment) {
      throw new NotFoundException(`Deployment ${id} not found`);
    }

    if (deployment.jobId) {
      try {
        const job = await this.deploymentQueue.getJob(deployment.jobId);
        if (job) {
          await job.remove();
        }
      } catch (error) {
        console.warn(`Failed to cancel job ${deployment.jobId}:`, error.message);
      }
    }

    await this.deploymentRepository.update(id, {
      status: 'cancelled',
      completedAt: new Date(),
    });
  }

  async listDeployments(query: DeploymentListQuery): Promise<DeploymentListResponse> {
    const { page = 1, limit = 20, status, provider } = query;
    const offset = (page - 1) * limit;

    const queryBuilder = this.deploymentRepository.createQueryBuilder('deployment');

    if (status) {
      queryBuilder.andWhere('deployment.status = :status', { status });
    }

    if (provider) {
      queryBuilder.andWhere('deployment.provider = :provider', { provider });
    }

    queryBuilder
      .orderBy('deployment.createdAt', 'DESC')
      .skip(offset)
      .take(limit);

    const [deployments, total] = await queryBuilder.getManyAndCount();

    return {
      deployments: deployments.map(deployment => ({
        id: deployment.id,
        status: deployment.status,
        provider: deployment.provider,
        url: deployment.deploymentUrl,
        detected: deployment.detectedStack,
        createdAt: deployment.createdAt,
        updatedAt: deployment.updatedAt,
        error: deployment.errorMessage,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateDeploymentStatus(
    id: string,
    status: Deployment['status'],
    data: Partial<{
      provider: string;
      deploymentUrl: string;
      detectedStack: any;
      errorMessage: string;
    }> = {},
  ): Promise<void> {
    const updateData: any = {
      status,
      updatedAt: new Date(),
      ...data,
    };

    if (status === 'building') {
      updateData.startedAt = new Date();
    } else if (['success', 'failed', 'cancelled'].includes(status)) {
      updateData.completedAt = new Date();
    }

    await this.deploymentRepository.update(id, updateData);
  }

  async appendLog(id: string, logEvent: LogEvent): Promise<void> {
    const deployment = await this.deploymentRepository.findOne({
      where: { id },
      select: ['buildLogs'],
    });

    if (!deployment) {
      return;
    }

    const logs = deployment.buildLogs || [];
    logs.push(logEvent);

    await this.deploymentRepository.update(id, {
      buildLogs: logs,
    });
  }
}