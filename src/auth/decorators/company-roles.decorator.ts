import { SetMetadata } from '@nestjs/common';
import type { CompanyRole } from '../interfaces/authenticated-request.interface';

export const COMPANY_ROLES_KEY = 'company_roles';

export const CompanyRoles = (...roles: CompanyRole[]) =>
  SetMetadata(COMPANY_ROLES_KEY, roles);