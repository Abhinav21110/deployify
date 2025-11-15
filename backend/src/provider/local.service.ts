import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeploymentProvider } from './interfaces/deployment-provider.interface';
import { DeploymentResult, ProviderCredentials, DeploymentConfig } from './dto/deployment.dto';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class LocalService implements DeploymentProvider {
  private readonly logger = new Logger(LocalService.name);
  readonly name = 'Local Static Hosting';
  readonly type = 'local';
  readonly supportsFreeTier = true;
  readonly maxFileSize = 1000; // MB - much higher for local
  readonly supportedProjectTypes = ['*']; // Supports all project types
  
  private readonly staticDir: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    // Create a local static hosting directory
    this.staticDir = path.join(process.cwd(), 'static-hosting');
    this.baseUrl = 'http://localhost:3000/static';
  }

  async validateCredentials(credentials?: ProviderCredentials): Promise<boolean> {
    // Local provider doesn't require credentials
    return true;
  }

  async deploy(
    projectPath: string,
    deploymentConfig: DeploymentConfig,
    credentials?: ProviderCredentials,
  ): Promise<DeploymentResult> {
    try {
      this.logger.log(`Deploying ${deploymentConfig.name} to local static hosting...`);

      // Generate a unique deployment ID
      const deploymentId = `deploy-${Date.now()}`;
      const deploymentDir = path.join(this.staticDir, deploymentId);

      // Ensure static hosting directory exists
      await fs.mkdir(this.staticDir, { recursive: true });
      await fs.mkdir(deploymentDir, { recursive: true });

      // Determine source directory (build directory or project root)
      const sourceDir = deploymentConfig.buildDirectory 
        ? path.join(projectPath, deploymentConfig.buildDirectory)
        : projectPath;

      // Copy source to deployment directory
      await this.copyDirectory(sourceDir, deploymentDir);

      // Generate deployment URL
      const deploymentUrl = `${this.baseUrl}/${deploymentId}`;

      this.logger.log(`Local deployment successful: ${deploymentUrl}`);

      return {
        success: true,
        deploymentId,
        url: deploymentUrl,
        provider: this.type,
        timestamp: new Date(),
        metadata: {
          deploymentDir,
          sourceDir,
          fileCount: await this.countFiles(deploymentDir).catch(() => 0),
        },
      };
    } catch (error) {
      this.logger.error('Local deployment failed:', error);
      return {
        success: false,
        error: error.message,
        provider: this.type,
        timestamp: new Date(),
      };
    }
  }

  async getDeploymentStatus(
    deploymentId: string,
    credentials?: ProviderCredentials,
  ): Promise<{
    status: 'pending' | 'building' | 'success' | 'failed';
    url?: string;
    error?: string;
    logs?: string[];
  }> {
    try {
      const deploymentDir = path.join(this.staticDir, deploymentId);
      const exists = await fs.access(deploymentDir).then(() => true).catch(() => false);

      if (exists) {
        return {
          status: 'success',
          url: `${this.baseUrl}/${deploymentId}`,
        };
      } else {
        return {
          status: 'failed',
          error: 'Deployment directory not found',
        };
      }
    } catch (error) {
      return {
        status: 'failed',
        error: error.message,
      };
    }
  }

  async deleteDeployment(deploymentId: string, credentials?: ProviderCredentials): Promise<boolean> {
    try {
      const deploymentDir = path.join(this.staticDir, deploymentId);
      await fs.rm(deploymentDir, { recursive: true, force: true });
      this.logger.log(`Deleted local deployment: ${deploymentId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete deployment ${deploymentId}:`, error);
      return false;
    }
  }

  getConfigRequirements(): {
    requiredFields: string[];
    optionalFields: string[];
    credentialFields: string[];
  } {
    return {
      requiredFields: ['name'],
      optionalFields: ['buildDirectory'],
      credentialFields: [], // No credentials required for local deployment
    };
  }

  private async copyDirectory(src: string, dest: string): Promise<void> {
    try {
      const entries = await fs.readdir(src, { withFileTypes: true });
      
      await fs.mkdir(dest, { recursive: true });

      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
          await this.copyDirectory(srcPath, destPath);
        } else {
          await fs.copyFile(srcPath, destPath);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to copy directory from ${src} to ${dest}:`, error);
      throw error;
    }
  }

  private async countFiles(dirPath: string): Promise<number> {
    try {
      let count = 0;
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          count += await this.countFiles(path.join(dirPath, entry.name));
        } else {
          count++;
        }
      }
      
      return count;
    } catch (error) {
      return 0;
    }
  }

  async listDeployments(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.staticDir, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);
    } catch (error) {
      this.logger.warn('Failed to list deployments:', error);
      return [];
    }
  }
}