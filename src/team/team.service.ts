import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { DRIZZLE } from '../db/db.constants';
import * as schema from '../db/schema';
import type { CompanyRole } from '../auth/interfaces/authenticated-request.interface';
import { AddTeamMemberDto } from './dto/add-team-member.dto';

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === '23505';

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

  async addMember(companyId: string, dto: AddTeamMemberDto) {
    const email = dto.email.trim().toLowerCase();

    const [user] = await this.db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
      })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (!user) {
      throw new NotFoundException(
        'No registered user found with this email.',
      );
    }

    try {
      const [membership] = await this.db
        .insert(schema.companyMemberships)
        .values({ companyId, userId: user.id, role: dto.role })
        .returning();

      if (!membership) {
        throw new Error('Team member creation failed.');
      }

      return {
        membershipId: membership.id,
        userId: user.id,
        name: user.name,
        email: user.email,
        role: membership.role,
        joinedAt: membership.createdAt,
      };
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'This user is already a member of the company.',
        );
      }
      throw error;
    }
  }

  async updateRole(
    companyId: string,
    membershipId: string,
    role: CompanyRole,
    requesterUserId: string,
  ) {
    const membership = await this.findMembershipOrThrow(
      companyId,
      membershipId,
    );

    // The requester is an ADMIN; blocking self-changes guarantees at least one admin remains.
    if (membership.userId === requesterUserId) {
      throw new BadRequestException('You cannot change your own role.');
    }

    const [updated] = await this.db
      .update(schema.companyMemberships)
      .set({ role })
      .where(eq(schema.companyMemberships.id, membership.id))
      .returning({
        membershipId: schema.companyMemberships.id,
        userId: schema.companyMemberships.userId,
        role: schema.companyMemberships.role,
      });

    return updated;
  }

  async removeMember(
    companyId: string,
    membershipId: string,
    requesterUserId: string,
  ) {
    const membership = await this.findMembershipOrThrow(
      companyId,
      membershipId,
    );

    if (membership.userId === requesterUserId) {
      throw new BadRequestException(
        'You cannot remove yourself from the company.',
      );
    }

    await this.db
      .delete(schema.companyMemberships)
      .where(eq(schema.companyMemberships.id, membership.id));

    return { message: 'Team member removed.' };
  }

  private async findMembershipOrThrow(
    companyId: string,
    membershipId: string,
  ) {
    const [membership] = await this.db
      .select({
        id: schema.companyMemberships.id,
        userId: schema.companyMemberships.userId,
      })
      .from(schema.companyMemberships)
      .where(
        and(
          eq(schema.companyMemberships.id, membershipId),
          eq(schema.companyMemberships.companyId, companyId),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new NotFoundException('Team member not found.');
    }

    return membership;
  }
}
