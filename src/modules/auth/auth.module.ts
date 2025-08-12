import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { LdapService } from './ldap.service';
import { PasswordPolicyService } from './password-policy.service';
import { PrismaService } from '../../config/prisma.service';
import { SapHanaService } from '../sap/sap-hana.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, LdapService, PasswordPolicyService, PrismaService, SapHanaService],
  exports: [AuthService, LdapService, PasswordPolicyService],
})
export class AuthModule {} 