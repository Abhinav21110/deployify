import { Injectable, Logger } from '@nestjs/common';
import { DeploymentLog } from '../provider/dto/deployment.dto';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class LoggingService {
  private readonly logger = new Logger(LoggingService.name);
  private readonly logDir: string;
  private readonly deploymentLogs = new Map<string, DeploymentLog[]>();
  private readonly logSubscribers = new Map<string, Array<(log: DeploymentLog) => void>>();

  constructor() {
    this.logDir = path.join(process.cwd(), 'logs', 'deployments');
    this.ensureLogDirectory();
  }

  private async ensureLogDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create log directory:', error);
    }
  }

  /**
   * Add a log entry for a deployment
   */
  async addLog(
    deploymentId: string,
    level: 'info' | 'warn' | 'error' | 'success',
    message: string,
    step?: string,
    metadata?: any,
  ): Promise<void> {
    const log: DeploymentLog = {
      id: `${deploymentId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      deploymentId,
      timestamp: new Date(),
      level,
      message,
      step,
      metadata,
    };

    // Store in memory
    if (!this.deploymentLogs.has(deploymentId)) {
      this.deploymentLogs.set(deploymentId, []);
    }
    this.deploymentLogs.get(deploymentId)!.push(log);

    // Persist to file
    await this.persistLog(deploymentId, log);

    // Notify subscribers (for real-time streaming)
    this.notifySubscribers(deploymentId, log);

    this.logger.debug(`[${deploymentId}] ${level.toUpperCase()}: ${message}`);
  }

  /**
   * Get all logs for a deployment
   */
  async getLogs(deploymentId: string): Promise<DeploymentLog[]> {
    // First check memory
    const memoryLogs = this.deploymentLogs.get(deploymentId);
    if (memoryLogs && memoryLogs.length > 0) {
      return memoryLogs;
    }

    // If not in memory, load from file
    return await this.loadLogsFromFile(deploymentId);
  }

  /**
   * Get recent logs for a deployment (last N entries)
   */
  async getRecentLogs(deploymentId: string, limit: number = 50): Promise<DeploymentLog[]> {
    const logs = await this.getLogs(deploymentId);
    return logs.slice(-limit);
  }

  /**
   * Subscribe to real-time log updates for a deployment
   */
  subscribeToLogs(deploymentId: string, callback: (log: DeploymentLog) => void): () => void {
    if (!this.logSubscribers.has(deploymentId)) {
      this.logSubscribers.set(deploymentId, []);
    }
    
    const subscribers = this.logSubscribers.get(deploymentId)!;
    subscribers.push(callback);

    // Return unsubscribe function
    return () => {
      const index = subscribers.indexOf(callback);
      if (index > -1) {
        subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Clear logs for a deployment
   */
  async clearLogs(deploymentId: string): Promise<void> {
    // Clear from memory
    this.deploymentLogs.delete(deploymentId);

    // Clear subscribers
    this.logSubscribers.delete(deploymentId);

    // Delete log file
    try {
      const logFilePath = path.join(this.logDir, `${deploymentId}.json`);
      await fs.unlink(logFilePath);
    } catch (error) {
      this.logger.debug(`Log file for ${deploymentId} not found or already deleted`);
    }
  }

  /**
   * Get deployment summary (stats about logs)
   */
  async getDeploymentSummary(deploymentId: string): Promise<{
    totalLogs: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
    successCount: number;
    duration?: number;
    startTime?: Date;
    endTime?: Date;
  }> {
    const logs = await this.getLogs(deploymentId);
    
    const summary = {
      totalLogs: logs.length,
      errorCount: logs.filter(l => l.level === 'error').length,
      warningCount: logs.filter(l => l.level === 'warn').length,
      infoCount: logs.filter(l => l.level === 'info').length,
      successCount: logs.filter(l => l.level === 'success').length,
      startTime: logs.length > 0 ? logs[0].timestamp : undefined,
      endTime: logs.length > 0 ? logs[logs.length - 1].timestamp : undefined,
    };

    // Calculate duration if we have start and end times
    if (summary.startTime && summary.endTime) {
      summary['duration'] = summary.endTime.getTime() - summary.startTime.getTime();
    }

    return summary;
  }

  /**
   * Search logs by message content
   */
  async searchLogs(deploymentId: string, searchTerm: string): Promise<DeploymentLog[]> {
    const logs = await this.getLogs(deploymentId);
    return logs.filter(log => 
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.step && log.step.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }

  /**
   * Get logs by level
   */
  async getLogsByLevel(deploymentId: string, level: DeploymentLog['level']): Promise<DeploymentLog[]> {
    const logs = await this.getLogs(deploymentId);
    return logs.filter(log => log.level === level);
  }

  /**
   * Cleanup old logs (older than specified days)
   */
  async cleanupOldLogs(olderThanDays: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const files = await fs.readdir(this.logDir);
      const logFiles = files.filter(file => file.endsWith('.json'));

      for (const file of logFiles) {
        const filePath = path.join(this.logDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          this.logger.log(`Cleaned up old log file: ${file}`);
        }
      }
    } catch (error) {
      this.logger.error('Failed to cleanup old logs:', error);
    }
  }

  private async persistLog(deploymentId: string, log: DeploymentLog): Promise<void> {
    try {
      const logFilePath = path.join(this.logDir, `${deploymentId}.json`);
      
      // Read existing logs
      let existingLogs: DeploymentLog[] = [];
      try {
        const content = await fs.readFile(logFilePath, 'utf-8');
        existingLogs = JSON.parse(content);
      } catch (error) {
        // File doesn't exist or is invalid, start with empty array
      }

      // Append new log
      existingLogs.push(log);

      // Write back to file
      await fs.writeFile(logFilePath, JSON.stringify(existingLogs, null, 2));
    } catch (error) {
      this.logger.error(`Failed to persist log for deployment ${deploymentId}:`, error);
    }
  }

  private async loadLogsFromFile(deploymentId: string): Promise<DeploymentLog[]> {
    try {
      const logFilePath = path.join(this.logDir, `${deploymentId}.json`);
      const content = await fs.readFile(logFilePath, 'utf-8');
      const logs = JSON.parse(content);
      
      // Store in memory for future access
      this.deploymentLogs.set(deploymentId, logs);
      
      return logs;
    } catch (error) {
      this.logger.debug(`No log file found for deployment ${deploymentId}`);
      return [];
    }
  }

  private notifySubscribers(deploymentId: string, log: DeploymentLog): void {
    const subscribers = this.logSubscribers.get(deploymentId);
    if (subscribers) {
      subscribers.forEach(callback => {
        try {
          callback(log);
        } catch (error) {
          this.logger.error('Error notifying log subscriber:', error);
        }
      });
    }
  }

  // Helper methods for common log patterns

  async logStep(deploymentId: string, step: string, message: string, metadata?: any): Promise<void> {
    await this.addLog(deploymentId, 'info', message, step, metadata);
  }

  async logError(deploymentId: string, error: string | Error, step?: string, metadata?: any): Promise<void> {
    const message = error instanceof Error ? error.message : error;
    await this.addLog(deploymentId, 'error', message, step, metadata);
  }

  async logSuccess(deploymentId: string, message: string, step?: string, metadata?: any): Promise<void> {
    await this.addLog(deploymentId, 'success', message, step, metadata);
  }

  async logWarning(deploymentId: string, message: string, step?: string, metadata?: any): Promise<void> {
    await this.addLog(deploymentId, 'warn', message, step, metadata);
  }
}