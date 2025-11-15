export interface ProviderCredentials {
  [key: string]: string | number | boolean;
}

export interface NetlifyCredentials extends ProviderCredentials {
  accessToken: string;
  siteId?: string;
}

export interface VercelCredentials extends ProviderCredentials {
  token: string;
  projectId?: string;
  teamId?: string;
}

export interface AWSCredentials extends ProviderCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  appId?: string;
}

export interface DeploymentConfig {
  name: string;
  branch: string;
  buildCommand?: string;
  buildDirectory?: string;
  environmentVariables?: Record<string, string>;
  redirects?: Array<{
    from: string;
    to: string;
    status: number;
  }>;
  headers?: Array<{
    for: string;
    values: Record<string, string>;
  }>;
}

export interface DeploymentResult {
  success: boolean;
  deploymentId?: string;
  url?: string;
  previewUrl?: string;
  error?: string;
  logs?: string[];
  provider: string;
  timestamp: Date;
  metadata?: {
    buildTime?: number;
    fileCount?: number;
    totalSize?: number;
    [key: string]: any;
  };
}

export interface ProjectAnalysis {
  type: 'static' | 'spa' | 'react' | 'vue' | 'angular' | 'next' | 'nuxt' | 'gatsby' | 'unknown';
  framework?: string;
  hasPackageJson: boolean;
  hasBuildScript: boolean;
  buildCommand?: string;
  buildDirectory?: string;
  isStaticHtml: boolean;
  estimatedSize: number;
  dependencies?: string[];
  environmentVariables?: string[];
}

export interface ProviderRecommendation {
  provider: string;
  score: number;
  reasons: string[];
  limitations?: string[];
  pricing?: 'free' | 'paid' | 'freemium';
  features: {
    customDomain: boolean;
    https: boolean;
    analytics: boolean;
    buildHooks: boolean;
    previewDeployments: boolean;
    rollbacks: boolean;
  };
}

export interface DeploymentLog {
  id: string;
  deploymentId: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  step?: string;
  metadata?: any;
}

export interface DeploymentJob {
  id: string;
  repositoryUrl: string;
  branch: string;
  provider: string;
  config: DeploymentConfig;
  credentials?: ProviderCredentials;
  status: 'queued' | 'cloning' | 'building' | 'deploying' | 'completed' | 'failed';
  progress: number;
  logs: DeploymentLog[];
  result?: DeploymentResult;
  createdAt: Date;
  updatedAt: Date;
}