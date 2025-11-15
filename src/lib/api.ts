import { z } from 'zod';

// TypeScript interfaces matching backend types
export interface DeploymentRequest {
  repoUrl: string;
  branch?: string;
  environment: 'school' | 'staging' | 'prod';
  budget: 'free' | 'low' | 'any';
  preferProviders?: string[];
  provider?: string;
  credentialId?: string;
  config?: {
    name?: string;
    buildCommand?: string;
    buildDirectory?: string;
    environmentVariables?: Record<string, string>;
  };
}

export interface DeploymentResponse {
  deploymentId: string;
  message?: string;
  estimatedTime?: string;
}

export interface DeploymentStatus {
  id: string;
  status: 'queued' | 'cloning' | 'building' | 'deploying' | 'success' | 'failed' | 'cancelled';
  provider?: string;
  url?: string;
  analysis?: ProjectAnalysis;
  createdAt: string;
  updatedAt: string;
  error?: string;
  metadata?: any;
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

export interface DeploymentLog {
  id: string;
  deploymentId: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  step?: string;
  metadata?: any;
}

export interface LogEvent {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: string;
  deploymentId: string;
}

export interface DeploymentListResponse {
  deployments: DeploymentStatus[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Provider and Credential Interfaces
export interface Provider {
  type: string;
  name: string;
  supportsFreeTier: boolean;
  maxFileSize: number;
  supportedProjectTypes: string[];
  configRequirements: {
    requiredFields: string[];
    optionalFields: string[];
    credentialFields: string[];
  };
}

export interface ProviderRecommendation {
  provider: string;
  score: number;
  reasons: string[];
  limitations?: string[];
  pricing: 'free' | 'paid' | 'freemium';
  features: {
    customDomain: boolean;
    https: boolean;
    analytics: boolean;
    buildHooks: boolean;
    previewDeployments: boolean;
    rollbacks: boolean;
  };
}

export interface Credential {
  id: string;
  provider: string;
  name?: string;
  isActive: boolean;
  isValid?: boolean;
  lastValidated?: string;
  createdAt: string;
}

export interface CreateCredentialDto {
  provider: string;
  credentials: Record<string, any>;
  name?: string;
}

export interface UpdateCredentialDto {
  credentials?: Record<string, any>;
  isActive?: boolean;
  name?: string;
}

export interface CredentialValidationResult {
  isValid: boolean;
  error?: string;
  providerInfo?: {
    name?: string;
    accountId?: string;
    permissions?: string[];
  };
}

// Validation schemas
export const deploymentRequestSchema = z.object({
  repoUrl: z.string().url().refine(
    (url) => url.startsWith('https://github.com/'),
    { message: 'Repository URL must be a valid GitHub repository' }
  ),
  branch: z.string().optional().default('main'),
  environment: z.enum(['school', 'staging', 'prod']),
  budget: z.enum(['free', 'low', 'any']),
  preferProviders: z.array(z.string()).optional(),
  provider: z.string().optional(),
  credentialId: z.string().optional(),
});

// API client class
class ApiClient {
  private baseURL: string;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorData}`);
      }

      return response.json();
    } catch (error) {
      console.error(`API request failed: ${url}`, error);
      throw error;
    }
  }

  // Deployment endpoints
  async createDeployment(data: DeploymentRequest): Promise<DeploymentResponse> {
    return this.request<DeploymentResponse>('/deploy', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getDeploymentStatus(id: string): Promise<DeploymentStatus> {
    return this.request<DeploymentStatus>(`/deploy/${id}/status`);
  }

  async cancelDeployment(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/deploy/${id}/cancel`, {
      method: 'POST',
    });
  }

  async getDeployments(
    page: number = 1,
    limit: number = 20,
    filters?: { status?: string; provider?: string }
  ): Promise<DeploymentListResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...filters,
    });

    return this.request<DeploymentListResponse>(`/deploy?${params}`);
  }

  // Deployment logs
  async getDeploymentLogs(
    deploymentId: string,
    options?: {
      limit?: number;
      level?: 'info' | 'warn' | 'error' | 'success';
      search?: string;
    }
  ): Promise<{ deploymentId: string; logs: DeploymentLog[]; totalCount: number }> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.level) params.set('level', options.level);
    if (options?.search) params.set('search', options.search);

    return this.request<{ deploymentId: string; logs: DeploymentLog[]; totalCount: number }>(
      `/deployments/${deploymentId}/logs?${params}`
    );
  }

  async getDeploymentLogSummary(deploymentId: string): Promise<{
    deploymentId: string;
    totalLogs: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
    successCount: number;
    duration?: number;
    startTime?: string;
    endTime?: string;
  }> {
    return this.request(`/deployments/${deploymentId}/logs/summary`);
  }

  // Provider endpoints
  async getProviders(): Promise<{ providers: Provider[] }> {
    return this.request<{ providers: Provider[] }>('/credentials/providers');
  }

  async getProviderRequirements(provider: string): Promise<{
    provider: string;
    requirements: {
      requiredFields: string[];
      optionalFields: string[];
      credentialFields: string[];
    };
    info: {
      name: string;
      supportsFreeTier: boolean;
      maxFileSize: number;
      supportedProjectTypes: string[];
    };
  }> {
    return this.request(`/credentials/providers/${provider}/requirements`);
  }

  // Credential endpoints
  async createCredentials(data: CreateCredentialDto): Promise<{
    message: string;
    credential: {
      id: string;
      provider: string;
      name: string;
      isActive: boolean;
      createdAt: string;
    };
  }> {
    return this.request('/credentials', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getUserCredentials(): Promise<{ credentials: Credential[] }> {
    return this.request<{ credentials: Credential[] }>('/credentials');
  }

  async updateCredentials(
    credentialId: string,
    data: UpdateCredentialDto
  ): Promise<{
    message: string;
    credential: {
      id: string;
      provider: string;
      name: string;
      isActive: boolean;
      updatedAt: string;
    };
  }> {
    return this.request(`/credentials/${credentialId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCredentials(credentialId: string): Promise<void> {
    return this.request(`/credentials/${credentialId}`, {
      method: 'DELETE',
    });
  }

  async validateCredentials(credentialId: string): Promise<CredentialValidationResult> {
    return this.request(`/credentials/${credentialId}/validate`, {
      method: 'POST',
    });
  }

  async validateAllCredentials(): Promise<{ message: string }> {
    return this.request('/credentials/validate-all', {
      method: 'POST',
    });
  }

  // Server-Sent Events for logs
  createLogStream(deploymentId: string): EventSource {
    const url = `${this.baseURL}/deployments/${deploymentId}/logs/stream`;
    return new EventSource(url);
  }

  // Health check
  async healthCheck(): Promise<any> {
    return this.request('/health');
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// React Query keys
export const queryKeys = {
  deployment: (id: string) => ['deployment', id] as const,
  deployments: (page: number, filters?: any) => ['deployments', page, filters] as const,
  deploymentLogs: (id: string, options?: any) => ['deployment-logs', id, options] as const,
  providers: () => ['providers'] as const,
  providerRequirements: (provider: string) => ['provider-requirements', provider] as const,
  credentials: () => ['credentials'] as const,
  health: () => ['health'] as const,
};

// Custom hooks for React Query
export const useCreateDeployment = () => {
  return (data: DeploymentRequest) => apiClient.createDeployment(data);
};

export const useDeploymentStatus = (id: string) => {
  return () => apiClient.getDeploymentStatus(id);
};

export const useDeployments = (page: number = 1, filters?: any) => {
  return () => apiClient.getDeployments(page, 20, filters);
};

export const useProviders = () => {
  return () => apiClient.getProviders();
};

export const useCredentials = () => {
  return () => apiClient.getUserCredentials();
};

export const useCreateCredentials = () => {
  return (data: CreateCredentialDto) => apiClient.createCredentials(data);
};

export const useDeploymentLogs = (deploymentId: string, options?: any) => {
  return () => apiClient.getDeploymentLogs(deploymentId, options);
};