import { IsIn } from 'class-validator';
import type { CompanyRole } from '../../auth/interfaces/authenticated-request.interface';
import { COMPANY_ROLES } from './add-team-member.dto';

export class UpdateTeamMemberRoleDto {
  @IsIn(COMPANY_ROLES)
  role!: CompanyRole;
}
