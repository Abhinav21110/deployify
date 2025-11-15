import { Injectable } from '@nestjs/common';
import { DeploymentProvider } from './interfaces/deployment-provider.interface';
import { ProjectAnalysis, ProviderRecommendation } from './dto/deployment.dto';

@Injectable()
export class ProviderRegistryService {
  private providers = new Map<string, DeploymentProvider>();

  /**
   * Register a deployment provider
   */
  registerProvider(provider: DeploymentProvider) {
    this.providers.set(provider.type, provider);
  }

  /**
   * Get a provider by type
   */
  getProvider(type: string): DeploymentProvider | undefined {
    return this.providers.get(type);
  }

  /**
   * Get all available providers
   */
  getAllProviders(): DeploymentProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get providers that support a specific project type
   */
  getProvidersForProjectType(projectType: string): DeploymentProvider[] {
    return Array.from(this.providers.values()).filter(provider =>
      provider.supportedProjectTypes.includes(projectType) ||
      provider.supportedProjectTypes.includes('*')
    );
  }

  /**
   * Recommend the best providers for a project
   */
  recommendProviders(
    analysis: ProjectAnalysis,
    preferFreeTier: boolean = true,
    maxFileSize?: number
  ): ProviderRecommendation[] {
    const compatibleProviders = this.getProvidersForProjectType(analysis.type);
    
    const recommendations = compatibleProviders.map(provider => {
      let score = 0;
      const reasons: string[] = [];
      const limitations: string[] = [];

      // Base compatibility score
      if (provider.supportedProjectTypes.includes(analysis.type)) {
        score += 40;
        reasons.push(`Supports ${analysis.type} projects`);
      }

      // Free tier bonus
      if (preferFreeTier && provider.supportsFreeTier) {
        score += 30;
        reasons.push('Offers free tier');
      }

      // File size compatibility
      if (maxFileSize && provider.maxFileSize < maxFileSize) {
        score -= 20;
        limitations.push(`File size limit: ${provider.maxFileSize}MB`);
      } else if (maxFileSize) {
        score += 10;
        reasons.push('Supports project size');
      }

      // Provider-specific scoring
      switch (provider.type) {
        case 'netlify':
          if (analysis.isStaticHtml || analysis.type === 'static') {
            score += 15;
            reasons.push('Excellent for static sites');
          }
          if (analysis.framework === 'gatsby' || analysis.framework === 'next') {
            score += 10;
            reasons.push('Great Jamstack support');
          }
          break;

        case 'vercel':
          if (analysis.framework === 'next' || analysis.framework === 'react') {
            score += 20;
            reasons.push('Optimized for React/Next.js');
          }
          if (analysis.type === 'spa') {
            score += 10;
            reasons.push('Great SPA support');
          }
          break;

        case 'aws-amplify':
          if (analysis.framework === 'react' || analysis.framework === 'vue' || analysis.framework === 'angular') {
            score += 15;
            reasons.push('Good framework support');
          }
          score += 5; // AWS reliability bonus
          break;

        case 'local':
          score += 5; // Always available fallback
          reasons.push('Local fallback option');
          limitations.push('Not publicly accessible');
          break;
      }

      // Determine pricing
      let pricing: 'free' | 'paid' | 'freemium' = 'paid';
      if (provider.supportsFreeTier) {
        pricing = provider.type === 'local' ? 'free' : 'freemium';
      }

      // Define features based on provider
      const features = {
        customDomain: provider.type !== 'local',
        https: provider.type !== 'local',
        analytics: ['netlify', 'vercel', 'aws-amplify'].includes(provider.type),
        buildHooks: ['netlify', 'vercel', 'aws-amplify'].includes(provider.type),
        previewDeployments: ['netlify', 'vercel', 'aws-amplify'].includes(provider.type),
        rollbacks: ['netlify', 'vercel', 'aws-amplify'].includes(provider.type),
      };

      return {
        provider: provider.type,
        score: Math.max(0, Math.min(100, score)),
        reasons,
        limitations: limitations.length > 0 ? limitations : undefined,
        pricing,
        features,
      };
    });

    // Sort by score descending
    return recommendations.sort((a, b) => b.score - a.score);
  }

  /**
   * Get the best provider for a project
   */
  getBestProvider(
    analysis: ProjectAnalysis,
    preferFreeTier: boolean = true,
    maxFileSize?: number
  ): string {
    const recommendations = this.recommendProviders(analysis, preferFreeTier, maxFileSize);
    return recommendations.length > 0 ? recommendations[0].provider : 'local';
  }
}