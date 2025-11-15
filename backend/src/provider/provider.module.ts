import { Module, OnModuleInit } from '@nestjs/common';
import { NetlifyService } from './netlify.service';
import { VercelService } from './vercel.service';
import { ProviderDecisionService } from './provider-decision.service';
import { ProviderRegistryService } from './provider-registry.service';

@Module({
  providers: [
    NetlifyService,
    VercelService,
    ProviderDecisionService,
    ProviderRegistryService,
  ],
  exports: [
    NetlifyService,
    VercelService,
    ProviderDecisionService,
    ProviderRegistryService,
  ],
})
export class ProviderModule implements OnModuleInit {
  constructor(
    private readonly providerRegistry: ProviderRegistryService,
    private readonly netlifyService: NetlifyService,
    private readonly vercelService: VercelService,
  ) {}

  onModuleInit() {
    // Register only Netlify and Vercel providers for bulletproof reliability
    this.providerRegistry.registerProvider(this.netlifyService);
    this.providerRegistry.registerProvider(this.vercelService);
  }
}