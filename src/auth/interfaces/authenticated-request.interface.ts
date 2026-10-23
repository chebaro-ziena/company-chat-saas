import type { Request } from 'express';

export type CompanyRole = 'ADMIN' | 'TEAM_MEMBER';

export interface AuthenticatedUser {
  userId: string;
  email: string;
}

export interface CompanyMembershipContext {
  id: string;
  companyId: string;
  userId: string;
  role: CompanyRole;
}

export type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
  companyMembership?: CompanyMembershipContext;
};