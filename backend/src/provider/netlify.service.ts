import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeploymentProvider } from './interfaces/deployment-provider.interface';
import { DeploymentResult, ProviderCredentials, NetlifyCredentials, DeploymentConfig } from './dto/deployment.dto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as FormData from 'form-data';
import * as archiver from 'archiver';
import axios from 'axios';

@Injectable()
export class NetlifyService implements DeploymentProvider {
  private readonly logger = new Logger(NetlifyService.name);
  readonly name = 'Netlify';
  readonly type = 'netlify';
  readonly supportsFreeTier = true;
  readonly maxFileSize = 125; // MB
  readonly supportedProjectTypes = ['static', 'spa', 'jamstack', 'react', 'vue', 'angular', 'gatsby', 'next'];

  constructor(private configService: ConfigService) {}

  async validateCredentials(credentials: ProviderCredentials): Promise<boolean> {
    try {
      const netlifyCredentials = credentials as NetlifyCredentials;
      if (!netlifyCredentials.accessToken) {
        return false;
      }

      const response = await axios.get('https://api.netlify.com/api/v1/user', {
        headers: {
          Authorization: `Bearer ${netlifyCredentials.accessToken}`,
        },
      });

      return response.status === 200;
    } catch (error) {
      this.logger.error('Failed to validate Netlify credentials:', error.message);
      return false;
    }
  }

  async deploy(
    projectPath: string,
    deploymentConfig: DeploymentConfig,
    credentials?: ProviderCredentials,
  ): Promise<DeploymentResult> {
    try {
      const netlifyCredentials = credentials as NetlifyCredentials;
      if (!netlifyCredentials?.accessToken) {
        throw new Error('Netlify access token is required');
      }

      this.logger.log(`Deploying ${deploymentConfig.name} to Netlify...`);

      // Create deployment zip
      const zipBuffer = await this.createDeploymentZip(projectPath, deploymentConfig.buildDirectory);

      // Create or get site
      const siteId = await this.ensureSite(netlifyCredentials, deploymentConfig.name);

      // Deploy to Netlify
      const deploymentResult = await this.deployToNetlify(
        siteId,
        zipBuffer,
        netlifyCredentials,
        deploymentConfig,
      );

      return {
        success: true,
        deploymentId: deploymentResult.id,
        url: deploymentResult.ssl_url || deploymentResult.url,
        previewUrl: deploymentResult.deploy_ssl_url,
        provider: this.type,
        timestamp: new Date(),
        metadata: {
          siteId,
          buildTime: deploymentResult.build_time_seconds,
          deployId: deploymentResult.id,
        },
      };
    } catch (error) {
      this.logger.error('Netlify deployment failed:', error.message);
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
      const netlifyCredentials = credentials as NetlifyCredentials;
      const response = await axios.get(
        `https://api.netlify.com/api/v1/deploys/${deploymentId}`,
        {
          headers: {
            Authorization: `Bearer ${netlifyCredentials.accessToken}`,
          },
        },
      );

      const deploy = response.data;
      let status: 'pending' | 'building' | 'success' | 'failed';

      switch (deploy.state) {
        case 'ready':
          status = 'success';
          break;
        case 'building':
        case 'processing':
          status = 'building';
          break;
        case 'error':
        case 'stopped':
          status = 'failed';
          break;
        default:
          status = 'pending';
      }

      return {
        status,
        url: deploy.ssl_url || deploy.url,
        error: deploy.error_message,
        logs: deploy.build_log ? [deploy.build_log] : undefined,
      };
    } catch (error) {
      this.logger.error('Failed to get Netlify deployment status:', error.message);
      return {
        status: 'failed',
        error: error.message,
      };
    }
  }

  async deleteDeployment(deploymentId: string, credentials?: ProviderCredentials): Promise<boolean> {
    try {
      const netlifyCredentials = credentials as NetlifyCredentials;
      await axios.delete(`https://api.netlify.com/api/v1/deploys/${deploymentId}`, {
        headers: {
          Authorization: `Bearer ${netlifyCredentials.accessToken}`,
        },
      });
      return true;
    } catch (error) {
      this.logger.error('Failed to delete Netlify deployment:', error.message);
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
      optionalFields: ['buildCommand', 'buildDirectory', 'environmentVariables', 'redirects', 'headers', 'siteId'],
      credentialFields: ['accessToken'],
    };
  }

  private async createDeploymentZip(projectPath: string, buildDir?: string): Promise<Buffer> {
    const deployPath = buildDir ? path.join(projectPath, buildDir) : projectPath;
    
    return new Promise((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } });
      const chunks: Buffer[] = [];

      archive.on('data', chunk => chunks.push(chunk));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);

      archive.directory(deployPath, false);
      archive.finalize();
    });
  }

  private async ensureSite(credentials: NetlifyCredentials, siteName: string): Promise<string> {
    if (credentials.siteId) {
      return credentials.siteId;
    }

    // Create new site
    const response = await axios.post(
      'https://api.netlify.com/api/v1/sites',
      {
        name: siteName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      },
      {
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return response.data.id;
  }

  private async deployToNetlify(
    siteId: string,
    zipBuffer: Buffer,
    credentials: NetlifyCredentials,
    config: DeploymentConfig,
  ) {
    const formData = new FormData();
    formData.append('file', zipBuffer, { filename: 'deploy.zip' });

    if (config.environmentVariables) {
      formData.append('functions', JSON.stringify(config.environmentVariables));
    }

    const response = await axios.post(
      `https://api.netlify.com/api/v1/sites/${siteId}/deploys`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          ...formData.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      },
    );

    return response.data;
  }
}