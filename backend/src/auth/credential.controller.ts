import { Controller, Get, Post, Put, Delete, Body, Param, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { CredentialService } from './credential.service';
import { CreateCredentialDto, UpdateCredentialDto } from './dto/credential.dto';
import { ProviderDecisionService } from '../provider/provider-decision.service';

@Controller('credentials')
export class CredentialController {
  private readonly logger = new Logger(CredentialController.name);

  constructor(
    private readonly credentialService: CredentialService,
    private readonly providerDecisionService: ProviderDecisionService,
  ) {}

  /**
   * Get all available providers and their requirements
   */
  @Get('providers')
  async getProviders() {
    try {
      const providers = this.providerDecisionService.getAllProviders();
      return {
        providers: providers.map(provider => ({
          type: provider.type,
          name: provider.name,
          supportsFreeTier: provider.supportsFreeTier,
          maxFileSize: provider.maxFileSize,
          supportedProjectTypes: provider.supportedProjectTypes,
          configRequirements: provider.configRequirements,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to get providers:', error);
      return { providers: [], error: error.message };
    }
  }

  /**
   * Get provider requirements
   */
  @Get('providers/:provider/requirements')
  async getProviderRequirements(@Param('provider') provider: string) {
    try {
      const providerInfo = this.providerDecisionService.getProviderInfo(provider);
      if (!providerInfo) {
        return { error: `Provider ${provider} not found` };
      }

      return {
        provider,
        requirements: providerInfo.configRequirements,
        info: {
          name: providerInfo.name,
          supportsFreeTier: providerInfo.supportsFreeTier,
          maxFileSize: providerInfo.maxFileSize,
          supportedProjectTypes: providerInfo.supportedProjectTypes,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get requirements for provider ${provider}:`, error);
      return { error: error.message };
    }
  }

  /**
   * Create new credentials
   */
  @Post()
  async createCredentials(@Body() dto: CreateCredentialDto) {
    try {
      // For demo purposes, using a static user ID
      // In a real app, this would come from authentication
      const userId = 'demo-user';
      
      const credential = await this.credentialService.createCredentials(userId, dto);
      
      return {
        message: 'Credentials created successfully',
        credential: {
          id: credential.id,
          provider: credential.provider,
          name: credential.name,
          isActive: credential.isActive,
          createdAt: credential.createdAt,
        },
      };
    } catch (error) {
      this.logger.error('Failed to create credentials:', error);
      return { error: error.message };
    }
  }

  /**
   * Get all credentials for the user
   */
  @Get()
  async getUserCredentials() {
    try {
      const userId = 'demo-user';
      const credentials = await this.credentialService.getUserCredentials(userId);
      
      return {
        credentials,
      };
    } catch (error) {
      this.logger.error('Failed to get user credentials:', error);
      return { credentials: [], error: error.message };
    }
  }

  /**
   * Update credentials
   */
  @Put(':id')
  async updateCredentials(
    @Param('id') credentialId: string,
    @Body() dto: UpdateCredentialDto,
  ) {
    try {
      const userId = 'demo-user';
      const credential = await this.credentialService.updateCredentials(userId, credentialId, dto);
      
      return {
        message: 'Credentials updated successfully',
        credential: {
          id: credential.id,
          provider: credential.provider,
          name: credential.name,
          isActive: credential.isActive,
          updatedAt: credential.updatedAt,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to update credentials ${credentialId}:`, error);
      return { error: error.message };
    }
  }

  /**
   * Delete credentials
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCredentials(@Param('id') credentialId: string) {
    try {
      const userId = 'demo-user';
      await this.credentialService.deleteCredentials(userId, credentialId);
    } catch (error) {
      this.logger.error(`Failed to delete credentials ${credentialId}:`, error);
      throw error;
    }
  }

  /**
   * Validate specific credentials
   */
  @Post(':id/validate')
  async validateCredentials(@Param('id') credentialId: string) {
    try {
      const userId = 'demo-user';
      const result = await this.credentialService.validateCredentials(userId, credentialId);
      
      return {
        credentialId,
        ...result,
      };
    } catch (error) {
      this.logger.error(`Failed to validate credentials ${credentialId}:`, error);
      return {
        credentialId,
        isValid: false,
        error: error.message,
      };
    }
  }

  /**
   * Validate all user credentials
   */
  @Post('validate-all')
  async validateAllCredentials() {
    try {
      const userId = 'demo-user';
      await this.credentialService.validateAllUserCredentials(userId);
      
      return {
        message: 'All credentials validation completed',
      };
    } catch (error) {
      this.logger.error('Failed to validate all credentials:', error);
      return { error: error.message };
    }
  }
}