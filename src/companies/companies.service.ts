
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { DRIZZLE } from '../db/db.constants';
import * as schema from '../db/schema';
import { CreateCompanyDto } from './dto/create-company.dto';

@Injectable()
export class CompaniesService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(userId: string, dto: CreateCompanyDto) {
    const name = dto.name.trim();
    const slug = dto.slug.trim().toLowerCase();

    if (name.length < 2) {
      throw new ConflictException(
        'Company name must contain at least 2 characters.',
      );
    }

    try {
      return await this.db.transaction(async (tx) => {
        // The latest subscription determines the user's current plan.
        const [subscription] = await tx
          .select()
          .from(schema.subscriptions)
          .where(eq(schema.subscriptions.userId, userId))
          .orderBy(desc(schema.subscriptions.createdAt))
          .limit(1);

        if (
          !subscription ||
          subscription.status !== 'ACTIVE' ||
          subscription.plan !== 'PAID'
        ) {
          throw new ForbiddenException(
            'An active Paid subscription is required to create a company.',
          );
        }


        if (subscription.companyId) {
          throw new ConflictException(
            'Your active subscription is already linked to a company.',
          );
        }

        const [company] = await tx
          .insert(schema.companies)
          .values({
            name,
            slug,
          })
          .returning();

        if (!company) {
          throw new Error('Company creation failed.');
        }

        // The authenticated user becomes this company's administrator.
        await tx.insert(schema.companyMemberships).values({
          companyId: company.id,
          userId,
          role: 'ADMIN',
        });

        // Associate the active subscription with the new company.
        await tx
          .update(schema.subscriptions)
          .set({
            companyId: company.id,
            updatedAt: new Date(),
          })
          .where(eq(schema.subscriptions.id, subscription.id));

        return {
          message: 'Company created successfully.',
          company,
          membership: {
            userId,
            companyId: company.id,
            role: 'ADMIN' as const,
          },
        };
      });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
      ) {
        throw new ConflictException(
          'This company slug is already in use. Please choose another.',
        );
      }

      throw error;
    }
  }

  async findOne(id: string) {
    const [company] = await this.db
      .select()
      .from(schema.companies)
      .where(eq(schema.companies.id, id))
      .limit(1);

    if (!company) {
      throw new NotFoundException('Company not found.');
    }

    return company;
  }
}

