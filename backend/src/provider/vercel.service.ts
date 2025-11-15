import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeploymentProvider } from './interfaces/deployment-provider.interface';
import { DeploymentResult, ProviderCredentials, VercelCredentials, DeploymentConfig } from './dto/deployment.dto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as FormData from 'form-data';
import axios from 'axios';

@Injectable()
export class VercelService implements DeploymentProvider {
  private readonly logger = new Logger(VercelService.name);
  readonly name = 'Vercel';
  readonly type = 'vercel';
  readonly supportsFreeTier = true;
  readonly maxFileSize = 100; // MB
  readonly supportedProjectTypes = ['static', 'spa', 'react', 'next', 'vue', 'angular', 'jamstack'];

  constructor(private configService: ConfigService) {}

  async validateCredentials(credentials: ProviderCredentials): Promise<boolean> {
    try {
      const vercelCredentials = credentials as VercelCredentials;
      if (!vercelCredentials.token) {
        return false;
      }

      const response = await axios.get('https://api.vercel.com/v2/user', {
        headers: {
          Authorization: `Bearer ${vercelCredentials.token}`,
        },
      });

      return response.status === 200;
    } catch (error) {
      this.logger.error('Failed to validate Vercel credentials:', error.message);
      return false;
    }
  }

  async deploy(
    projectPath: string,
    deploymentConfig: DeploymentConfig,
    credentials?: ProviderCredentials,
  ): Promise<DeploymentResult> {
    try {
      const vercelCredentials = credentials as VercelCredentials;
      if (!vercelCredentials?.token) {
        throw new Error('Vercel token is required');
      }

      this.logger.log(`Deploying ${deploymentConfig.name} to Vercel...`);

      // Prepare deployment files
      const files = await this.prepareDeploymentFiles(projectPath, deploymentConfig.buildDirectory);

      // Create deployment
      const deployment = await this.createVercelDeployment(
        files,
        vercelCredentials,
        deploymentConfig,
      );

      // Wait for deployment to complete
      const finalDeployment = await this.waitForDeployment(deployment.id, vercelCredentials);

      return {
        success: finalDeployment.readyState === 'READY',
        deploymentId: finalDeployment.id,
        url: `https://${finalDeployment.url}`,
        previewUrl: `https://${finalDeployment.url}`,
        provider: this.type,
        timestamp: new Date(),
        metadata: {
          deploymentId: finalDeployment.id,
          domain: finalDeployment.url,
          buildTime: finalDeployment.buildingAt ? 
            new Date(finalDeployment.ready || Date.now()).getTime() - new Date(finalDeployment.buildingAt).getTime() : 
            undefined,
        },
      };
    } catch (error) {
      this.logger.error('Vercel deployment failed:', error.message);
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
      const vercelCredentials = credentials as VercelCredentials;
      const response = await axios.get(
        `https://api.vercel.com/v13/deployments/${deploymentId}`,
        {
          headers: {
            Authorization: `Bearer ${vercelCredentials.token}`,
          },
        },
      );

      const deployment = response.data;
      let status: 'pending' | 'building' | 'success' | 'failed';

      switch (deployment.readyState) {
        case 'READY':
          status = 'success';
          break;
        case 'BUILDING':
          status = 'building';
          break;
        case 'ERROR':
        case 'CANCELED':
          status = 'failed';
          break;
        default:
          status = 'pending';
      }

      return {
        status,
        url: deployment.url ? `https://${deployment.url}` : undefined,
        error: deployment.errorMessage,
      };
    } catch (error) {
      this.logger.error('Failed to get Vercel deployment status:', error.message);
      return {
        status: 'failed',
        error: error.message,
      };
    }
  }

  async deleteDeployment(deploymentId: string, credentials?: ProviderCredentials): Promise<boolean> {
    try {
      const vercelCredentials = credentials as VercelCredentials;
      await axios.delete(`https://api.vercel.com/v13/deployments/${deploymentId}`, {
        headers: {
          Authorization: `Bearer ${vercelCredentials.token}`,
        },
      });
      return true;
    } catch (error) {
      this.logger.error('Failed to delete Vercel deployment:', error.message);
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
      optionalFields: ['buildCommand', 'buildDirectory', 'environmentVariables'],
      credentialFields: ['token', 'projectId', 'teamId'],
    };
  }

  private async prepareDeploymentFiles(projectPath: string, buildDir?: string): Promise<any[]> {
    const deployPath = buildDir ? path.join(projectPath, buildDir) : projectPath;
    const files = [];

    async function readDirectory(dirPath: string, relativePath = '') {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativeFilePath = path.posix.join(relativePath, entry.name);

        if (entry.isDirectory()) {
          await readDirectory(fullPath, relativeFilePath);
        } else {
          const content = await fs.readFile(fullPath);
          files.push({
            file: relativeFilePath,
            data: content.toString('base64'),
            encoding: 'base64',
          });
        }
      }
    }

    await readDirectory(deployPath);
    return files;
  }

  private async createVercelDeployment(
    files: any[],
    credentials: VercelCredentials,
    config: DeploymentConfig,
  ) {
    const deploymentData = {
      name: config.name,
      files,
      projectSettings: {
        buildCommand: config.buildCommand,
        outputDirectory: config.buildDirectory,
      },
      env: config.environmentVariables || {},
    };

    if (credentials.projectId) {
      deploymentData['project'] = credentials.projectId;
    }

    if (credentials.teamId) {
      deploymentData['teamId'] = credentials.teamId;
    }

    const response = await axios.post(
      'https://api.vercel.com/v13/deployments',
      deploymentData,
      {
        headers: {
          Authorization: `Bearer ${credentials.token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return response.data;
  }

  private async waitForDeployment(deploymentId: string, credentials: VercelCredentials, maxAttempts = 30): Promise<any> {
    for (let i = 0; i < maxAttempts; i++) {
      const response = await axios.get(
        `https://api.vercel.com/v13/deployments/${deploymentId}`,
        {
          headers: {
            Authorization: `Bearer ${credentials.token}`,
          },
        },
      );

      const deployment = response.data;
      if (deployment.readyState === 'READY' || deployment.readyState === 'ERROR') {
        return deployment;
      }

      // Wait 2 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error('Deployment timeout');
  }
}