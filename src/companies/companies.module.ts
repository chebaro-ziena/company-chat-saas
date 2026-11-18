
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CompanyMembershipGuard } from '../auth/guards/company-membership.guard';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';

@Module({
  imports: [AuthModule],
  controllers: [CompaniesController],
  providers: [
    CompaniesService,
    CompanyMembershipGuard,
  ],
  exports: [CompaniesService],
})
export class CompaniesModule {}

