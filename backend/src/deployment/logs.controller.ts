import { Controller, Get, Param, Sse, MessageEvent, Query, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { LoggingService } from '../common/logging.service';
import { DeploymentLog } from '../provider/dto/deployment.dto';

@Controller('deployments')
export class LogsController {
  private readonly logger = new Logger(LogsController.name);

  constructor(private readonly loggingService: LoggingService) {}

  /**
   * Stream real-time logs for a deployment via SSE
   */
  @Sse(':id/logs/stream')
  streamLogs(@Param('id') deploymentId: string): Observable<MessageEvent> {
    this.logger.log(`Starting log stream for deployment: ${deploymentId}`);

    return new Observable(observer => {
      // Send existing logs first
      this.loggingService.getLogs(deploymentId)
        .then(existingLogs => {
          existingLogs.forEach(log => {
            observer.next({
              data: JSON.stringify(log),
              type: 'log',
            });
          });
        })
        .catch(error => {
          this.logger.error(`Failed to load existing logs for ${deploymentId}:`, error);
        });

      // Subscribe to new logs
      const unsubscribe = this.loggingService.subscribeToLogs(deploymentId, (log: DeploymentLog) => {
        observer.next({
          data: JSON.stringify(log),
          type: 'log',
        });
      });

      // Send periodic heartbeat
      const heartbeat = setInterval(() => {
        observer.next({
          data: JSON.stringify({ timestamp: new Date(), type: 'heartbeat' }),
          type: 'heartbeat',
        });
      }, 30000); // Every 30 seconds

      // Cleanup on disconnect
      return () => {
        this.logger.log(`Closing log stream for deployment: ${deploymentId}`);
        unsubscribe();
        clearInterval(heartbeat);
      };
    });
  }

  /**
   * Get deployment logs (paginated)
   */
  @Get(':id/logs')
  async getLogs(
    @Param('id') deploymentId: string,
    @Query('limit') limit?: number,
    @Query('level') level?: 'info' | 'warn' | 'error' | 'success',
    @Query('search') search?: string,
  ) {
    try {
      let logs = await this.loggingService.getLogs(deploymentId);

      // Filter by level if specified
      if (level) {
        logs = logs.filter(log => log.level === level);
      }

      // Filter by search term if specified
      if (search) {
        logs = await this.loggingService.searchLogs(deploymentId, search);
      }

      // Apply limit
      if (limit) {
        logs = logs.slice(-limit);
      }

      return {
        deploymentId,
        logs,
        totalCount: logs.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get logs for deployment ${deploymentId}:`, error);
      return {
        deploymentId,
        logs: [],
        totalCount: 0,
        error: error.message,
      };
    }
  }

  /**
   * Get deployment summary with log statistics
   */
  @Get(':id/logs/summary')
  async getLogSummary(@Param('id') deploymentId: string) {
    try {
      const summary = await this.loggingService.getDeploymentSummary(deploymentId);
      return {
        deploymentId,
        ...summary,
      };
    } catch (error) {
      this.logger.error(`Failed to get log summary for deployment ${deploymentId}:`, error);
      return {
        deploymentId,
        error: error.message,
      };
    }
  }

  /**
   * Get logs by specific level
   */
  @Get(':id/logs/:level')
  async getLogsByLevel(
    @Param('id') deploymentId: string,
    @Param('level') level: 'info' | 'warn' | 'error' | 'success',
    @Query('limit') limit?: number,
  ) {
    try {
      let logs = await this.loggingService.getLogsByLevel(deploymentId, level);

      if (limit) {
        logs = logs.slice(-limit);
      }

      return {
        deploymentId,
        level,
        logs,
        count: logs.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get ${level} logs for deployment ${deploymentId}:`, error);
      return {
        deploymentId,
        level,
        logs: [],
        count: 0,
        error: error.message,
      };
    }
  }

  /**
   * Clear logs for a deployment
   */
  @Get(':id/logs/clear')
  async clearLogs(@Param('id') deploymentId: string) {
    try {
      await this.loggingService.clearLogs(deploymentId);
      return {
        deploymentId,
        message: 'Logs cleared successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to clear logs for deployment ${deploymentId}:`, error);
      return {
        deploymentId,
        error: error.message,
      };
    }
  }
}