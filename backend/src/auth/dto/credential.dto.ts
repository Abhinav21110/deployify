export interface UserCredentials {
  id: string;
  userId: string;
  provider: string;
  credentials: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
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

export interface CredentialSummary {
  id: string;
  provider: string;
  name?: string;
  isActive: boolean;
  isValid?: boolean;
  lastValidated?: Date;
  createdAt: Date;
}