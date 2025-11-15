import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeploymentProvider } from './interfaces/deployment-provider.interface';
import { DeploymentResult, ProviderCredentials, AWSCredentials, DeploymentConfig } from './dto/deployment.dto';
import { AmplifyClient, CreateAppCommand, CreateBranchCommand, StartDeploymentCommand, GetJobCommand } from '@aws-sdk/client-amplify';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as archiver from 'archiver';

@Injectable()
export class AwsAmplifyService implements DeploymentProvider {
  private readonly logger = new Logger(AwsAmplifyService.name);
  readonly name = 'AWS Amplify';
  readonly type = 'aws-amplify';
  readonly supportsFreeTier = true;
  readonly maxFileSize = 200; // MB
  readonly supportedProjectTypes = ['static', 'spa', 'react', 'vue', 'angular', 'next'];

  constructor(private configService: ConfigService) {}

  async validateCredentials(credentials: ProviderCredentials): Promise<boolean> {
    try {
      const awsCredentials = credentials as AWSCredentials;
      if (!awsCredentials.accessKeyId || !awsCredentials.secretAccessKey) {
        return false;
      }

      const client = new AmplifyClient({
        region: awsCredentials.region || 'us-east-1',
        credentials: {
          accessKeyId: awsCredentials.accessKeyId,
          secretAccessKey: awsCredentials.secretAccessKey,
        },
      });

      // Test credentials by listing apps
      await client.send({ 
        $metadata: {},
        input: {},
        name: 'ListAppsCommand'
      } as any);

      return true;
    } catch (error) {
      this.logger.error('Failed to validate AWS credentials:', error.message);
      return false;
    }
  }

  async deploy(
    projectPath: string,
    deploymentConfig: DeploymentConfig,
    credentials?: ProviderCredentials,
  ): Promise<DeploymentResult> {
    try {
      const awsCredentials = credentials as AWSCredentials;
      if (!awsCredentials?.accessKeyId || !awsCredentials?.secretAccessKey) {
        throw new Error('AWS credentials are required');
      }

      this.logger.log(`Deploying ${deploymentConfig.name} to AWS Amplify...`);

      const client = new AmplifyClient({
        region: awsCredentials.region || 'us-east-1',
        credentials: {
          accessKeyId: awsCredentials.accessKeyId,
          secretAccessKey: awsCredentials.secretAccessKey,
        },
      });

      // Ensure app exists
      const appId = await this.ensureAmplifyApp(client, awsCredentials, deploymentConfig.name);

      // Create deployment
      const deployment = await this.deployToAmplify(
        client,
        appId,
        projectPath,
        deploymentConfig,
      );

      return {
        success: true,
        deploymentId: deployment.jobId,
        url: `https://main.${appId}.amplifyapp.com`,
        provider: this.type,
        timestamp: new Date(),
        metadata: {
          appId,
          jobId: deployment.jobId,
          region: awsCredentials.region || 'us-east-1',
        },
      };
    } catch (error) {
      this.logger.error('AWS Amplify deployment failed:', error.message);
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
      const awsCredentials = credentials as AWSCredentials;
      const client = new AmplifyClient({
        region: awsCredentials.region || 'us-east-1',
        credentials: {
          accessKeyId: awsCredentials.accessKeyId,
          secretAccessKey: awsCredentials.secretAccessKey,
        },
      });

      const [appId, jobId] = deploymentId.split(':');
      const response = await client.send(
        new GetJobCommand({
          appId,
          branchName: 'main',
          jobId,
        }),
      );

      const job = response.job;
      let status: 'pending' | 'building' | 'success' | 'failed';

      switch (job.summary.status) {
        case 'SUCCEED':
          status = 'success';
          break;
        case 'RUNNING':
        case 'PENDING':
          status = 'building';
          break;
        case 'FAILED':
        case 'CANCELLED':
          status = 'failed';
          break;
        default:
          status = 'pending';
      }

      return {
        status,
        url: status === 'success' ? `https://main.${appId}.amplifyapp.com` : undefined,
        error: status === 'failed' ? 'Deployment failed' : undefined,
      };
    } catch (error) {
      this.logger.error('Failed to get AWS Amplify deployment status:', error.message);
      return {
        status: 'failed',
        error: error.message,
      };
    }
  }

  async deleteDeployment(deploymentId: string, credentials?: ProviderCredentials): Promise<boolean> {
    try {
      // AWS Amplify doesn't support deleting individual deployments
      // This would require deleting the entire app or branch
      this.logger.warn('AWS Amplify does not support deleting individual deployments');
      return false;
    } catch (error) {
      this.logger.error('Failed to delete AWS Amplify deployment:', error.message);
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
      credentialFields: ['accessKeyId', 'secretAccessKey', 'region', 'appId'],
    };
  }

  private async ensureAmplifyApp(
    client: AmplifyClient,
    credentials: AWSCredentials,
    appName: string,
  ): Promise<string> {
    if (credentials.appId) {
      return credentials.appId;
    }

    // Create new app
    const response = await client.send(
      new CreateAppCommand({
        name: appName,
        description: `Deployed via Deployify`,
        platform: 'WEB',
      }),
    );

    const appId = response.app.appId;

    // Create main branch
    await client.send(
      new CreateBranchCommand({
        appId,
        branchName: 'main',
        description: 'Main deployment branch',
      }),
    );

    return appId;
  }

  private async deployToAmplify(
    client: AmplifyClient,
    appId: string,
    projectPath: string,
    config: DeploymentConfig,
  ) {
    // Create deployment zip
    const deploymentZip = await this.createDeploymentZip(projectPath, config.buildDirectory);

    // Start deployment
    const response = await client.send(
      new StartDeploymentCommand({
        appId,
        branchName: 'main',
        sourceUrl: deploymentZip,
      }),
    );

    return {
      jobId: `${appId}:${response.jobSummary.jobId}`,
      appId,
    };
  }

  private async createDeploymentZip(projectPath: string, buildDir?: string): Promise<string> {
    const deployPath = buildDir ? path.join(projectPath, buildDir) : projectPath;
    
    // For this implementation, we'll return a placeholder
    // In a real implementation, you'd upload to S3 and return the S3 URL
    return `s3://amplify-deployments/${Date.now()}-deployment.zip`;
  }
}