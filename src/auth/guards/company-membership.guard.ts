import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { DRIZZLE } from '../../db/db.constants';
import * as schema from '../../db/schema';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

@Injectable()
export class CompanyMembershipGuard implements CanActivate {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();

    const user = request.user;
    const companyId = request.params.companyId;

    if (typeof companyId !== 'string' || !companyId) {
        throw new ForbiddenException(
            'A valid companyId route parameter is required.',
        );
    }

    if (!user) {
      throw new UnauthorizedException('Authentication required.');
    }

    if (!companyId) {
      throw new ForbiddenException(
        'The companyId route parameter is required.',
      );
    }

    const [membership] = await this.db
      .select({
        id: schema.companyMemberships.id,
        companyId: schema.companyMemberships.companyId,
        userId: schema.companyMemberships.userId,
        role: schema.companyMemberships.role,
      })
      .from(schema.companyMemberships)
      .where(
        and(
          eq(schema.companyMemberships.companyId, companyId),
          eq(schema.companyMemberships.userId, user.userId),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new ForbiddenException(
        'You do not belong to this company.',
      );
    }

    request.companyMembership = membership;

    return true;
  }
}