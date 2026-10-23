
import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../db/db.constants';
import { subscriptions } from '../db/schema';

@Injectable()
export class SubscriptionsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: any,
  ) {}

  getPlans() {
    return [
      {
        id: 'FREE',
        name: 'Free',
        price: 0,
        currency: 'USD',
        features: [
          'Create a company',
          'Manage products',
          'Basic customer chat',
        ],
      },
      {
        id: 'PAID',
        name: 'Paid',
        price: null,
        currency: 'USD',
        features: [
          'Advanced company features',
          'Team management',
          'Enhanced customer support tools',
        ],
      },
    ];
  }

  async getMySubscription(userId: string) {
    const [subscription] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    return { subscription: subscription ?? null };
  }

  async activateFreePlan(userId: string) {
    const [activeSubscription] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    if (activeSubscription?.status === 'ACTIVE') {
      throw new ConflictException(
        'You already have an active subscription.',
      );
    }

    const [subscription] = await this.db
      .insert(subscriptions)
      .values({
        userId,
        companyId: null,
        plan: 'FREE',
        status: 'ACTIVE',
      })
      .returning();

    return {
      message: 'Free plan activated successfully.',
      subscription,
    };
  }
}

