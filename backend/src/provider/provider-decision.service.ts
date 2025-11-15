import { Injectable, Logger } from '@nestjs/common';
import { ProviderRegistryService } from './provider-registry.service';
import { DeploymentResult, ProviderCredentials, DeploymentConfig, ProjectAnalysis, ProviderRecommendation } from './dto/deployment.dto';

interface ProviderSelectionOptions {
  analysis: ProjectAnalysis;
  environment: 'school' | 'staging' | 'prod';
  budget: 'free' | 'low' | 'any';
  preferProviders?: string[];
  maxFileSize?: number;
}

interface DeploymentOptions {
  provider: string;
  projectPath: string;
  config: DeploymentConfig;
  credentials?: ProviderCredentials;
}

@Injectable()
export class ProviderDecisionService {
  private readonly logger = new Logger(ProviderDecisionService.name);

  constructor(private readonly providerRegistry: ProviderRegistryService) {}

  async selectProvider(options: ProviderSelectionOptions): Promise<string> {
    const { analysis, preferProviders } = options;

    try {
      // Simplified provider selection for Netlify and Vercel only
      
      // User preference takes priority
      if (preferProviders && preferProviders.length > 0) {
        const preferred = preferProviders[0];
        if (preferred === 'netlify' || preferred === 'vercel') {
          this.logger.log(`Selected user-preferred provider: ${preferred}`);
          return preferred;
        }
      }

      // Smart defaults based on project type
      // Next.js projects work best on Vercel (made by Vercel team)
      if (analysis.framework === 'next' || analysis.type === 'next') {
        this.logger.log('Selected provider: vercel for Next.js project');
        return 'vercel';
      }

      // Static HTML projects work great on Netlify
      if (analysis.isStaticHtml || analysis.type === 'static') {
        this.logger.log('Selected provider: netlify for static project');
        return 'netlify';
      }

      // Default to Vercel for SPAs (React, Vue, etc.)
      this.logger.log(`Selected provider: vercel for ${analysis.type} project`);
      return 'vercel';
    } catch (error) {
      this.logger.error('Provider selection failed:', error);
      // Default fallback to Vercel
      return 'vercel';
    }
  }

  async getProviderRecommendations(
    analysis: ProjectAnalysis,
    preferFreeTier: boolean = true,
    maxFileSize?: number,
  ): Promise<ProviderRecommendation[]> {
    return this.providerRegistry.recommendProviders(analysis, preferFreeTier, maxFileSize);
  }

  async deployToProvider(options: DeploymentOptions): Promise<DeploymentResult> {
    const { provider, projectPath, config, credentials } = options;

    try {
      // Only accept Netlify or Vercel
      if (provider !== 'netlify' && provider !== 'vercel') {
        throw new Error(`Provider ${provider} is not supported. Only 'netlify' and 'vercel' are available.`);
      }

      this.logger.log(`Deploying to ${provider}...`);

      const deploymentProvider = this.providerRegistry.getProvider(provider);
      if (!deploymentProvider) {
        throw new Error(`Provider ${provider} not found`);
      }

      // Validate credentials if provided
      if (credentials && !(await deploymentProvider.validateCredentials(credentials))) {
        throw new Error(`Invalid credentials for provider ${provider}`);
      }

      // Deploy to the provider
      const result = await deploymentProvider.deploy(projectPath, config, credentials);

      return result;
    } catch (error) {
      this.logger.error(`Deployment to ${provider} failed:`, error);
      
      return {
        success: false,
        error: error.message,
        provider,
        timestamp: new Date(),
      };
    }
  }

  async validateProviderCredentials(provider: string, credentials: ProviderCredentials): Promise<boolean> {
    try {
      const deploymentProvider = this.providerRegistry.getProvider(provider);
      if (!deploymentProvider) {
        return false;
      }

      return await deploymentProvider.validateCredentials(credentials);
    } catch (error) {
      this.logger.error(`Failed to validate credentials for ${provider}:`, error);
      return false;
    }
  }

  async getDeploymentStatus(
    provider: string,
    deploymentId: string,
    credentials?: ProviderCredentials,
  ): Promise<{
    status: 'pending' | 'building' | 'success' | 'failed';
    url?: string;
    error?: string;
    logs?: string[];
  }> {
    try {
      const deploymentProvider = this.providerRegistry.getProvider(provider);
      if (!deploymentProvider) {
        return { status: 'failed', error: `Provider ${provider} not found` };
      }

      return await deploymentProvider.getDeploymentStatus(deploymentId, credentials);
    } catch (error) {
      this.logger.error(`Failed to get deployment status from ${provider}:`, error);
      return { status: 'failed', error: error.message };
    }
  }

  async deleteDeployment(
    provider: string,
    deploymentId: string,
    credentials?: ProviderCredentials,
  ): Promise<boolean> {
    try {
      const deploymentProvider = this.providerRegistry.getProvider(provider);
      if (!deploymentProvider) {
        return false;
      }

      return await deploymentProvider.deleteDeployment(deploymentId, credentials);
    } catch (error) {
      this.logger.error(`Failed to delete deployment from ${provider}:`, error);
      return false;
    }
  }

  getAllProviders() {
    return this.providerRegistry.getAllProviders().map(provider => ({
      name: provider.name,
      type: provider.type,
      supportsFreeTier: provider.supportsFreeTier,
      maxFileSize: provider.maxFileSize,
      supportedProjectTypes: provider.supportedProjectTypes,
      configRequirements: provider.getConfigRequirements(),
    }));
  }

  getProviderInfo(providerType: string) {
    const provider = this.providerRegistry.getProvider(providerType);
    if (!provider) {
      return null;
    }

    return {
      name: provider.name,
      type: provider.type,
      supportsFreeTier: provider.supportsFreeTier,
      maxFileSize: provider.maxFileSize,
      supportedProjectTypes: provider.supportedProjectTypes,
      configRequirements: provider.getConfigRequirements(),
    };
  }
}