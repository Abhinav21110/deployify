import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Sse,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Observable, interval, map, switchMap, takeWhile } from 'rxjs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';

import { DeploymentService } from './deployment.service';
import { CreateDeploymentDto, DeploymentResponseDto, DeploymentStatusDto } from './dto/deployment.dto';
import { DeploymentStatus, LogEvent } from '../common/types';

@ApiTags('Deployments')
@Controller('deploy')
@UseGuards(ThrottlerGuard)
export class DeploymentController {
  constructor(private readonly deploymentService: DeploymentService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new deployment' })
  @ApiResponse({
    status: 201,
    description: 'Deployment created successfully',
    type: DeploymentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid deployment request',
  })
  @HttpCode(HttpStatus.CREATED)
  async createDeployment(
    @Body() createDeploymentDto: CreateDeploymentDto,
  ): Promise<DeploymentResponseDto> {
    try {
      // Validate GitHub URL format
      const githubUrlPattern = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
      if (!githubUrlPattern.test(createDeploymentDto.repoUrl)) {
        throw new BadRequestException('Repository URL must be a valid GitHub repository');
      }

      // Enhanced deployment creation with provider credentials and configuration
      const deployment = await this.deploymentService.createDeployment({
        ...createDeploymentDto,
      });
      
      return {
        deploymentId: deployment.id,
      };
    } catch (error) {
      throw new BadRequestException(error.message || 'Failed to create deployment');
    }
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get deployment status' })
  @ApiResponse({
    status: 200,
    description: 'Deployment status retrieved successfully',
    type: DeploymentStatusDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Deployment not found',
  })
  async getDeploymentStatus(@Param('id') id: string): Promise<DeploymentStatus> {
    return this.deploymentService.getDeploymentStatus(id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a deployment' })
  @ApiResponse({
    status: 200,
    description: 'Deployment cancelled successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Deployment not found',
  })
  @HttpCode(HttpStatus.OK)
  async cancelDeployment(@Param('id') id: string): Promise<{ message: string }> {
    await this.deploymentService.cancelDeployment(id);
    return { message: 'Deployment cancelled successfully' };
  }

  @Get(':id/logs/sse')
  @ApiOperation({ summary: 'Stream deployment logs via Server-Sent Events' })
  @Sse()
  streamLogs(@Param('id') id: string): Observable<MessageEvent> {
    return interval(1000).pipe(
      switchMap(async () => {
        const logs = await this.deploymentService.getDeploymentLogs(id);
        const active = await this.deploymentService.isDeploymentActive(id);
        return { logs, active } as { logs: LogEvent[]; active: boolean };
      }),
      takeWhile(({ active }) => active, true),
      map(({ logs }) => ({
        data: JSON.stringify(logs),
        type: 'log-update',
      } as MessageEvent)),
    );
  }

  @Get()
  @ApiOperation({ summary: 'List deployments with pagination' })
  @ApiResponse({
    status: 200,
    description: 'Deployments retrieved successfully',
  })
  async listDeployments(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('status') status?: string,
    @Query('provider') provider?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    
    return this.deploymentService.listDeployments({
      page: pageNum,
      limit: limitNum,
      status,
      provider,
    });
  }
}