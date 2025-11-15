import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

import { UserCredentials } from './entities/user-credentials.entity';
import { ProviderDecisionService } from '../provider/provider-decision.service';
import { 
  CredentialValidationResult, 
  CreateCredentialDto, 
  UpdateCredentialDto,
  CredentialSummary 
} from './dto/credential.dto';

@Injectable()
export class CredentialService {
  private readonly logger = new Logger(CredentialService.name);
  private readonly encryptionKey: string;
  private readonly algorithm = 'aes-256-gcm';

  constructor(
    @InjectRepository(UserCredentials)
    private credentialRepository: Repository<UserCredentials>,
    private providerDecisionService: ProviderDecisionService,
    private configService: ConfigService,
  ) {
    this.encryptionKey = this.configService.get<string>('ENCRYPTION_KEY') || this.generateEncryptionKey();
  }

  /**
   * Create new credentials for a user
   */
  async createCredentials(userId: string, dto: CreateCredentialDto): Promise<UserCredentials> {
    try {
      // Check if credentials already exist for this provider
      const existing = await this.credentialRepository.findOne({
        where: { userId, provider: dto.provider, isActive: true },
      });

      if (existing) {
        throw new ConflictException(`Active credentials already exist for provider ${dto.provider}`);
      }

      // Validate credentials with the provider
      const validationResult = await this.validateCredentialsWithProvider(dto.provider, dto.credentials);

      if (!validationResult.isValid) {
        throw new Error(`Invalid credentials: ${validationResult.error}`);
      }

      // Encrypt credentials
      const encryptedCredentials = this.encrypt(JSON.stringify(dto.credentials));

      // Create credential record
      const credential = this.credentialRepository.create({
        userId,
        provider: dto.provider,
        name: dto.name || `${dto.provider} credentials`,
        encryptedCredentials,
        isActive: true,
        isValid: true,
        lastValidated: new Date(),
      });

      return await this.credentialRepository.save(credential);
    } catch (error) {
      this.logger.error(`Failed to create credentials for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get all credentials for a user
   */
  async getUserCredentials(userId: string): Promise<CredentialSummary[]> {
    try {
      const credentials = await this.credentialRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
      });

      return credentials.map(cred => ({
        id: cred.id,
        provider: cred.provider,
        name: cred.name,
        isActive: cred.isActive,
        isValid: cred.isValid,
        lastValidated: cred.lastValidated,
        createdAt: cred.createdAt,
      }));
    } catch (error) {
      this.logger.error(`Failed to get credentials for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get credentials by ID (decrypted for usage)
   */
  async getCredentialsById(userId: string, credentialId: string): Promise<any> {
    try {
      const credential = await this.credentialRepository.findOne({
        where: { id: credentialId, userId },
      });

      if (!credential) {
        throw new NotFoundException('Credentials not found');
      }

      if (!credential.isActive) {
        throw new Error('Credentials are inactive');
      }

      // Decrypt and return credentials
      const decryptedCredentials = this.decrypt(credential.encryptedCredentials);
      return JSON.parse(decryptedCredentials);
    } catch (error) {
      this.logger.error(`Failed to get credentials ${credentialId}:`, error);
      throw error;
    }
  }

  /**
   * Get active credentials for a specific provider
   */
  async getProviderCredentials(userId: string, provider: string): Promise<any | null> {
    try {
      const credential = await this.credentialRepository.findOne({
        where: { userId, provider, isActive: true },
      });

      if (!credential) {
        return null;
      }

      // Decrypt and return credentials
      const decryptedCredentials = this.decrypt(credential.encryptedCredentials);
      return JSON.parse(decryptedCredentials);
    } catch (error) {
      this.logger.error(`Failed to get ${provider} credentials for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Update credentials
   */
  async updateCredentials(
    userId: string,
    credentialId: string,
    dto: UpdateCredentialDto,
  ): Promise<UserCredentials> {
    try {
      const credential = await this.credentialRepository.findOne({
        where: { id: credentialId, userId },
      });

      if (!credential) {
        throw new NotFoundException('Credentials not found');
      }

      let isValid = credential.isValid;
      let lastValidated = credential.lastValidated;

      // If updating credentials, validate them
      if (dto.credentials) {
        const validationResult = await this.validateCredentialsWithProvider(
          credential.provider,
          dto.credentials,
        );

        if (!validationResult.isValid) {
          throw new Error(`Invalid credentials: ${validationResult.error}`);
        }

        credential.encryptedCredentials = this.encrypt(JSON.stringify(dto.credentials));
        isValid = true;
        lastValidated = new Date();
      }

      // Update other fields
      if (dto.isActive !== undefined) {
        credential.isActive = dto.isActive;
      }

      if (dto.name !== undefined) {
        credential.name = dto.name;
      }

      credential.isValid = isValid;
      credential.lastValidated = lastValidated;

      return await this.credentialRepository.save(credential);
    } catch (error) {
      this.logger.error(`Failed to update credentials ${credentialId}:`, error);
      throw error;
    }
  }

  /**
   * Delete credentials
   */
  async deleteCredentials(userId: string, credentialId: string): Promise<void> {
    try {
      const credential = await this.credentialRepository.findOne({
        where: { id: credentialId, userId },
      });

      if (!credential) {
        throw new NotFoundException('Credentials not found');
      }

      await this.credentialRepository.remove(credential);
      this.logger.log(`Deleted credentials ${credentialId} for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to delete credentials ${credentialId}:`, error);
      throw error;
    }
  }

  /**
   * Get credentials by ID for system/worker usage (no userId check)
   * Use this for deployment workers where user context is not available
   */
  async getCredentialForDeployment(credentialId: string): Promise<{ provider: string; credentials: any; isActive: boolean }> {
    try {
      const credential = await this.credentialRepository.findOne({
        where: { id: credentialId },
      });

      if (!credential) {
        throw new NotFoundException('Credentials not found');
      }

      if (!credential.isActive) {
        throw new Error('Credentials are inactive');
      }

      // Decrypt and return credentials
      const decryptedCredentials = this.decrypt(credential.encryptedCredentials);
      return {
        provider: credential.provider,
        credentials: JSON.parse(decryptedCredentials),
        isActive: credential.isActive,
      };
    } catch (error) {
      this.logger.error(`Failed to get credentials ${credentialId} for deployment:`, error);
      throw error;
    }
  }

  /**
   * Get first available credential for a provider
   * Used for auto-credential selection in deployments
   */
  async getFirstCredentialForProvider(provider: string): Promise<{
    id: string;
    provider: string;
    credentials: any;
    isActive: boolean;
  } | null> {
    try {
      const credential = await this.credentialRepository.findOne({
        where: { provider, isActive: true },
        order: { createdAt: 'DESC' },
      });

      if (!credential) {
        return null;
      }

      const decryptedCredentials = this.decrypt(credential.encryptedCredentials);
      return {
        id: credential.id,
        provider: credential.provider,
        credentials: JSON.parse(decryptedCredentials),
        isActive: credential.isActive,
      };
    } catch (error) {
      this.logger.error(`Failed to auto-fetch credentials for ${provider}:`, error);
      return null;
    }
  }

  /**
   * Validate credentials with the actual provider
   */
  async validateCredentials(userId: string, credentialId: string): Promise<CredentialValidationResult> {
    try {
      const credential = await this.credentialRepository.findOne({
        where: { id: credentialId, userId },
      });

      if (!credential) {
        throw new NotFoundException('Credentials not found');
      }

      const decryptedCredentials = JSON.parse(this.decrypt(credential.encryptedCredentials));
      const validationResult = await this.validateCredentialsWithProvider(
        credential.provider,
        decryptedCredentials,
      );

      // Update validation status
      credential.isValid = validationResult.isValid;
      credential.lastValidated = new Date();
      await this.credentialRepository.save(credential);

      return validationResult;
    } catch (error) {
      this.logger.error(`Failed to validate credentials ${credentialId}:`, error);
      return {
        isValid: false,
        error: error.message,
      };
    }
  }

  /**
   * Validate all credentials for a user
   */
  async validateAllUserCredentials(userId: string): Promise<void> {
    try {
      const credentials = await this.credentialRepository.find({
        where: { userId, isActive: true },
      });

      for (const credential of credentials) {
        await this.validateCredentials(userId, credential.id);
      }
    } catch (error) {
      this.logger.error(`Failed to validate all credentials for user ${userId}:`, error);
    }
  }

  private async validateCredentialsWithProvider(
    provider: string,
    credentials: any,
  ): Promise<CredentialValidationResult> {
    try {
      const isValid = await this.providerDecisionService.validateProviderCredentials(provider, credentials);

      if (isValid) {
        return {
          isValid: true,
          providerInfo: {
            name: provider,
          },
        };
      } else {
        return {
          isValid: false,
          error: 'Credentials validation failed',
        };
      }
    } catch (error) {
      this.logger.error(`Provider validation failed for ${provider}:`, error);
      return {
        isValid: false,
        error: error.message,
      };
    }
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  private generateEncryptionKey(): string {
    const key = crypto.randomBytes(32).toString('hex');
    this.logger.warn('Generated new encryption key. Set ENCRYPTION_KEY environment variable to persist credentials between restarts.');
    return key;
  }
}
