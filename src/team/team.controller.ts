import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';

import { TeamService } from './team.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompanyMembershipGuard } from '../auth/guards/company-membership.guard';
import { CompanyRolesGuard } from '../auth/guards/company-roles.guard';
import { CompanyRoles } from '../auth/decorators/company-roles.decorator';

@Controller('companies/:companyId/team')
@UseGuards(
  JwtAuthGuard,
  CompanyMembershipGuard,
  CompanyRolesGuard,
)
@CompanyRoles('ADMIN')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get()
  findAll(
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ) {
    return this.teamService.findByCompany(companyId);
  }
}
