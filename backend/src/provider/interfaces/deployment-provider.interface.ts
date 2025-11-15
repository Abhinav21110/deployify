import { DeploymentResult, ProviderCredentials } from '../dto/deployment.dto';

export interface DeploymentProvider {
  /**
   * Provider name for identification
   */
  readonly name: string;

  /**
   * Provider type (e.g., 'netlify', 'vercel', 'aws-amplify', 'local')
   */
  readonly type: string;

  /**
   * Whether the provider supports free tier deployments
   */
  readonly supportsFreeTier: boolean;

  /**
   * Maximum file size supported (in MB)
   */
  readonly maxFileSize: number;

  /**
   * Supported project types (e.g., 'static', 'spa', 'ssr', 'jamstack')
   */
  readonly supportedProjectTypes: string[];

  /**
   * Validate provider credentials
   */
  validateCredentials(credentials: ProviderCredentials): Promise<boolean>;

  /**
   * Deploy a project to the provider
   */
  deploy(
    projectPath: string,
    deploymentConfig: any,
    credentials?: ProviderCredentials,
  ): Promise<DeploymentResult>;

  /**
   * Get deployment status
   */
  getDeploymentStatus(deploymentId: string, credentials?: ProviderCredentials): Promise<{
    status: 'pending' | 'building' | 'success' | 'failed';
    url?: string;
    error?: string;
    logs?: string[];
  }>;

  /**
   * Delete a deployment
   */
  deleteDeployment(deploymentId: string, credentials?: ProviderCredentials): Promise<boolean>;

  /**
   * Get provider-specific configuration requirements
   */
  getConfigRequirements(): {
    requiredFields: string[];
    optionalFields: string[];
    credentialFields: string[];
  };
}