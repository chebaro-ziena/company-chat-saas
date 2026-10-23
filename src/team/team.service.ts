import {
  Inject,
  Injectable,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { DRIZZLE } from '../db/db.constants';
import * as schema from '../db/schema';

@Injectable()
export class TeamService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  findByCompany(companyId: string) {
    return this.db
      .select({
        membershipId: schema.companyMemberships.id,
        userId: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        role: schema.companyMemberships.role,
        joinedAt: schema.companyMemberships.createdAt,
      })
      .from(schema.companyMemberships)
      .innerJoin(
        schema.users,
        eq(schema.companyMemberships.userId, schema.users.id),
      )
      .where(eq(schema.companyMemberships.companyId, companyId));
  }
}