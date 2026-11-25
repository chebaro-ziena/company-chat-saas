import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { TeamService } from './team.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompanyMembershipGuard } from '../auth/guards/company-membership.guard';
import { CompanyRolesGuard } from '../auth/guards/company-roles.guard';
import { CompanyRoles } from '../auth/decorators/company-roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { AddTeamMemberDto } from './dto/add-team-member.dto';
import { UpdateTeamMemberRoleDto } from './dto/update-team-member-role.dto';

const getUserId = (req: AuthenticatedRequest): string => {
  if (!req.user) {
    throw new UnauthorizedException('Authentication required.');
  }
  return req.user.userId;
};

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

  @Post()
  addMember(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: AddTeamMemberDto,
  ) {
    return this.teamService.addMember(companyId, dto);
  }

  @Patch(':membershipId')
  updateRole(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @Body() dto: UpdateTeamMemberRoleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.teamService.updateRole(
      companyId,
      membershipId,
      dto.role,
      getUserId(req),
    );
  }

  @Delete(':membershipId')
  removeMember(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.teamService.removeMember(
      companyId,
      membershipId,
      getUserId(req),
    );
  }
}
