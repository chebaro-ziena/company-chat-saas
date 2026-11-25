import { IsEmail, IsIn, MaxLength } from 'class-validator';
import type { CompanyRole } from '../../auth/interfaces/authenticated-request.interface';

export const COMPANY_ROLES: readonly CompanyRole[] = ['ADMIN', 'TEAM_MEMBER'];

export class AddTeamMemberDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsIn(COMPANY_ROLES)
  role!: CompanyRole;
}
