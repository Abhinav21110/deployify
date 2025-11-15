import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserCredentials } from './entities/user-credentials.entity';
import { CredentialService } from './credential.service';
import { CredentialController } from './credential.controller';
import { ProviderModule } from '../provider/provider.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'fallback-secret'),
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([UserCredentials]),
    ProviderModule,
  ],
  controllers: [CredentialController],
  providers: [CredentialService],
  exports: [JwtModule, CredentialService],
})
export class AuthModule {}