import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bull';

import { DeploymentService } from '../deployment/deployment.service';
import { ProjectAnalysisService } from './project-analysis.service';
import { ContainerService } from './container.service';
import { ProviderDecisionService } from '../provider/provider-decision.service';
import { LoggingService } from '../common/logging.service';
import { CredentialService } from '../auth/credential.service';
import { DeploymentConfig, DeploymentResult } from '../provider/dto/deployment.dto';

interface DeploymentJobData {
  deploymentId: string;
  repoUrl: string;
  branch: string;
  environment: 'school' | 'staging' | 'prod';
  budget: 'free' | 'low' | 'any';
  preferProviders?: string[];
  provider?: string;
  credentialId?: string;
  config?: Partial<DeploymentConfig>;
}

@Processor('deployment')
@Injectable()
export class DeploymentWorker {
  private readonly logger = new Logger(DeploymentWorker.name);
  private readonly DEPLOYMENT_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
  private readonly MAX_RETRIES = 2;

  constructor(
    private deploymentService: DeploymentService,
    private projectAnalysisService: ProjectAnalysisService,
    private containerService: ContainerService,
    private providerDecisionService: ProviderDecisionService,
    private loggingService: LoggingService,
    private credentialService: CredentialService,
  ) {}

  @Process('process-deployment')
  async processDeployment(job: Job<DeploymentJobData>) {
    const { deploymentId, repoUrl, branch, environment, budget, preferProviders, provider, credentialId, config } = job.data;
    let workspaceDir: string | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      // Set up timeout protection
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Deployment timeout: exceeded 15 minute limit'));
        }, this.DEPLOYMENT_TIMEOUT_MS);
      });

      // Run deployment with timeout
      await Promise.race([
        this.executeDeployment(job, deploymentId, repoUrl, branch, environment, budget, preferProviders, provider, credentialId, config),
        timeoutPromise
      ]);

      // Clear timeout if successful
      if (timeoutId) clearTimeout(timeoutId);

    } catch (error) {
      // Clear timeout on error
      if (timeoutId) clearTimeout(timeoutId);

      this.logger.error(`Deployment ${deploymentId} failed:`, error);
      await this.loggingService.logError(deploymentId, error.message, 'deployment');
      
      // Check if we should retry
      const attemptCount = job.attemptsMade || 0;
      if (attemptCount < this.MAX_RETRIES && !error.message.includes('timeout')) {
        this.logger.log(`Retrying deployment ${deploymentId} (attempt ${attemptCount + 1}/${this.MAX_RETRIES})`);
        throw error; // Let Bull handle the retry
      }

      await this.deploymentService.updateDeploymentStatus(deploymentId, 'failed', {
        errorMessage: error.message,
      });
    } finally {
      // Always cleanup workspace
      if (workspaceDir) {
        try {
          await this.containerService.cleanup(workspaceDir);
          this.logger.log(`Cleaned up workspace for deployment ${deploymentId}`);
        } catch (cleanupError) {
          this.logger.error(`Failed to cleanup workspace for ${deploymentId}:`, cleanupError);
        }
      }
    }
  }

  private async executeDeployment(
    job: Job<DeploymentJobData>,
    deploymentId: string,
    repoUrl: string,
    branch: string,
    environment: 'school' | 'staging' | 'prod',
    budget: 'free' | 'low' | 'any',
    preferProviders: string[] | undefined,
    provider: string | undefined,
    credentialId: string | undefined,
    config: Partial<DeploymentConfig> | undefined
  ): Promise<DeploymentResult> {
    let workspaceDir: string | null = null;
    
    try {
      await this.loggingService.logStep(deploymentId, 'initialization', 'Starting deployment process...');
      job.progress(0);

      // Step 1: Clone repository
      await this.deploymentService.updateDeploymentStatus(deploymentId, 'cloning');
      await this.loggingService.logStep(deploymentId, 'clone', `Cloning repository ${repoUrl}...`);
      job.progress(10);

      workspaceDir = await this.containerService.cloneRepository(repoUrl, branch);
      await this.loggingService.logSuccess(deploymentId, 'Repository cloned successfully', 'clone');

      // Step 2: Analyze project
      await this.deploymentService.updateDeploymentStatus(deploymentId, 'building'); // Use 'building' as closest status
      await this.loggingService.logStep(deploymentId, 'analysis', 'Analyzing project structure...');
      job.progress(20);

      const projectAnalysis = await this.projectAnalysisService.analyzeProject(workspaceDir);
      
      // Log detailed analysis results
      await this.loggingService.logStep(deploymentId, 'analysis', `Framework: ${projectAnalysis.framework || 'unknown'}`);
      await this.loggingService.logStep(deploymentId, 'analysis', `Project type: ${projectAnalysis.type}`);
      await this.loggingService.logStep(deploymentId, 'analysis', `Build command: ${projectAnalysis.buildCommand || 'none'}`);
      await this.loggingService.logStep(deploymentId, 'analysis', `Build directory: ${projectAnalysis.buildDirectory || 'none'}`);
      
      await this.loggingService.logSuccess(
        deploymentId,
        `Detected ${projectAnalysis.framework || 'unknown'} (${projectAnalysis.type}) project`,
        'analysis',
        { analysis: projectAnalysis }
      );

      // Step 3: Select provider
      await this.loggingService.logStep(deploymentId, 'provider-selection', 'Selecting optimal deployment provider...');
      job.progress(30);

      let selectedProvider = provider; // Use explicitly provided provider
      if (!selectedProvider) {
        // Auto-select provider based on project analysis
        selectedProvider = await this.providerDecisionService.selectProvider({
          analysis: projectAnalysis,
          environment,
          budget,
          preferProviders,
          maxFileSize: projectAnalysis.estimatedSize,
        });
      }

      await this.loggingService.logSuccess(deploymentId, `Selected provider: ${selectedProvider}`, 'provider-selection');

      // Step 3.5: Fetch credentials if credentialId provided, or auto-fetch for provider
      let credentials: any = null;
      if (credentialId) {
        try {
          await this.loggingService.logStep(deploymentId, 'credentials', 'Fetching deployment credentials...');
          const credentialData = await this.credentialService.getCredentialForDeployment(credentialId);
          
          if (!credentialData.isActive) {
            throw new Error('Selected credential is inactive');
          }
          
          if (credentialData.provider !== selectedProvider) {
            throw new Error(`Credential provider (${credentialData.provider}) does not match selected provider (${selectedProvider})`);
          }
          
          credentials = credentialData.credentials;
          await this.loggingService.logSuccess(deploymentId, 'Credentials loaded successfully', 'credentials');
        } catch (error) {
          await this.loggingService.logError(deploymentId, `Failed to load credentials: ${error.message}`, 'credentials');
          throw new Error(`Credential error: ${error.message}`);
        }
      } else {
        // Try to auto-fetch first available credential for the provider
        await this.loggingService.logStep(deploymentId, 'credentials', `Auto-fetching credentials for ${selectedProvider}...`);
        const autoCredential = await this.credentialService.getFirstCredentialForProvider(selectedProvider);
        
        if (autoCredential) {
          credentials = autoCredential.credentials;
          await this.loggingService.logSuccess(deploymentId, `Auto-selected credential for ${selectedProvider}`, 'credentials');
        } else {
          await this.loggingService.logError(deploymentId, `No credentials found for ${selectedProvider} - please add credentials in Settings`, 'credentials');
          throw new Error(`No credentials available for ${selectedProvider}. Please add credentials in Settings.`);
        }
      }

      // Step 4: Build project (if needed)
      job.progress(40);
      let buildPath = workspaceDir;

      if (projectAnalysis.hasBuildScript && !projectAnalysis.isStaticHtml) {
        await this.loggingService.logStep(deploymentId, 'build', 'Building project...');
        await this.loggingService.logStep(deploymentId, 'build', `Using build command: ${projectAnalysis.buildCommand || 'npm run build'}`);
        await this.loggingService.logStep(deploymentId, 'build', `Expected output directory: ${projectAnalysis.buildDirectory || 'dist'}`);
        
        const buildResult = await this.containerService.buildProject({
          workspaceDir,
          detectedStack: {
            framework: projectAnalysis.framework || 'unknown',
            type: this.mapProjectType(projectAnalysis.type),
            packageManager: 'npm',
            hasDockerfile: false,
            distDir: projectAnalysis.buildDirectory || 'dist', // Map build directory correctly
          },
          deploymentId,
          onLog: (level, message) => this.loggingService.addLog(deploymentId, level as any, message, 'build'),
        });

        if (!buildResult.success) {
          throw new Error(buildResult.error || 'Build failed');
        }

        buildPath = buildResult.artifactPath;
        
        // Check what was actually built
        const fs = require('fs');
        const path = require('path');
        
        await this.loggingService.logStep(deploymentId, 'build', `Build artifacts created at: ${buildPath}`);
        
        try {
          const artifactContents = fs.readdirSync(buildPath);
          await this.loggingService.logStep(deploymentId, 'build', `Artifact contents: ${artifactContents.join(', ')}`);
        } catch (listError) {
          await this.loggingService.logStep(deploymentId, 'build', `Could not list artifact contents: ${listError.message}`);
        }
        
        await this.loggingService.logSuccess(deploymentId, 'Project built successfully', 'build');
      } else {
        await this.loggingService.logStep(deploymentId, 'build', 'Skipping build step (static HTML project or no build script)');
      }

      job.progress(70);

      // Step 5: Create deployment config
      const deploymentConfig: DeploymentConfig = {
        name: config?.name || `deployment-${Date.now()}`,
        branch,
        buildCommand: projectAnalysis.buildCommand,
        buildDirectory: projectAnalysis.buildDirectory,
        environmentVariables: config?.environmentVariables,
        ...config,
      };

      // Step 6: Deploy to provider
      await this.deploymentService.updateDeploymentStatus(deploymentId, 'deploying');
      await this.loggingService.logStep(deploymentId, 'deployment', `Deploying to ${selectedProvider}...`);
      await this.loggingService.logStep(deploymentId, 'deployment', `Deployment source path: ${buildPath}`);
      await this.loggingService.logStep(deploymentId, 'deployment', `Build directory config: ${deploymentConfig.buildDirectory}`);
      job.progress(80);

      const deployResult = await this.providerDecisionService.deployToProvider({
        provider: selectedProvider,
        projectPath: buildPath,
        config: deploymentConfig,
        credentials,
      });

      if (!deployResult.success) {
        throw new Error(deployResult.error || 'Deployment failed');
      }

      job.progress(100);

      // Step 7: Success
      await this.deploymentService.updateDeploymentStatus(deploymentId, 'success', {
        deploymentUrl: deployResult.url,
      });

      await this.loggingService.logSuccess(
        deploymentId,
        `Deployment successful! Available at: ${deployResult.url}`,
        'deployment',
        { 
          url: deployResult.url,
          provider: deployResult.provider,
          deploymentId: deployResult.deploymentId,
          metadata: deployResult.metadata,
        }
      );

      return deployResult;

    } catch (error: any) {
      this.logger.error(`Deployment ${deploymentId} failed:`, error);

      await this.deploymentService.updateDeploymentStatus(deploymentId, 'failed', {
        errorMessage: error?.message || String(error),
      });

      await this.loggingService.logError(
        deploymentId,
        error?.message || String(error),
        'deployment',
        { error: error?.stack }
      );

      throw error;
    } finally {
      // Always cleanup workspace
      if (workspaceDir) {
        try {
          await this.containerService.cleanup(workspaceDir);
          await this.loggingService.logStep(deploymentId, 'cleanup', 'Workspace cleaned up');
        } catch (cleanupError) {
          this.logger.warn(`Failed to cleanup workspace ${workspaceDir}: ${cleanupError.message}`);
          await this.loggingService.logWarning(
            deploymentId,
            `Failed to cleanup workspace: ${cleanupError.message}`,
            'cleanup'
          );
        }
      }
    }
  }

  private mapProjectType(analysisType: string): 'static' | 'spa' | 'ssr' | 'api' | 'fullstack' | 'container' {
    switch (analysisType) {
      case 'static':
        return 'static';
      case 'spa':
      case 'react':
      case 'vue':
      case 'angular':
        return 'spa';
      case 'next':
      case 'nuxt':
        return 'ssr';
      case 'gatsby':
        return 'static';
      default:
        return 'static';
    }
  }
}
