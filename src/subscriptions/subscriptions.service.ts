
import {
  Injectable,
  Inject,
  ConflictException,
  InternalServerErrorException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { desc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema';
import { DRIZZLE } from '../db/db.constants';
import { subscriptions } from '../db/schema';

@Injectable()
export class SubscriptionsService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  private getStripe(): Stripe {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      throw new InternalServerErrorException(
        'STRIPE_SECRET_KEY is not configured.',
      );
    }

    return new Stripe(secretKey);
  }

  private getSubscriptionPeriodEnd(
    subscription: Stripe.Subscription,
  ): Date | null {
    const periodEnd =
      subscription.items.data[0]?.current_period_end;

    return typeof periodEnd === 'number'
      ? new Date(periodEnd * 1000)
      : null;
  }

  getPlans() {
    return [
      {
        id: 'FREE',
        name: 'Free',
        price: 0,
        currency: 'USD',
        features: [
          'Browse products',
          'Buy products',
          'Customer chat',
        ],
      },
      {
        id: 'PAID',
        name: 'Paid',
        price: 20,
        currency: 'USD',
        interval: 'month',
        features: [
          'Create and manage a Company',
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
    const [existing] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    if (existing?.status === 'ACTIVE') {
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

  async createPaidCheckoutSession(userId: string) {
  const priceId = process.env.STRIPE_PAID_PRICE_ID;
  const frontendUrl = process.env.FRONTEND_URL;

  if (!priceId || !frontendUrl) {
    throw new InternalServerErrorException(
      'STRIPE_PAID_PRICE_ID or FRONTEND_URL is not configured.',
    );
  }

  const stripe = this.getStripe();

  // Diagnostic: verify the exact Price ID loaded by NestJS.
  console.log('[Stripe checkout] Price ID:', JSON.stringify(priceId));
  console.log('[Stripe checkout] Key mode:',
    process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')
      ? 'TEST'
      : process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')
        ? 'LIVE'
        : 'UNKNOWN',
  );

  // Confirm this exact ID exists for this exact Stripe client.
  const price = await stripe.prices.retrieve(priceId);

  console.log('[Stripe checkout] Retrieved price:', {
    id: price.id,
    active: price.active,
    currency: price.currency,
    amount: price.unit_amount,
    interval: price.recurring?.interval,
  });

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: price.id, quantity: 1 }],
    client_reference_id: userId,
    metadata: { userId, plan: 'PAID' },
    subscription_data: {
      metadata: { userId, plan: 'PAID' },
    },
    success_url: `${frontendUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl}/?checkout=cancelled`,
  });

  if (!session.url) {
    throw new InternalServerErrorException(
      'Stripe did not return a Checkout URL.',
    );
  }

  return { url: session.url };
}

  constructStripeEvent(
    rawBody: Buffer,
    signature: string,
  ): Stripe.Event {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new InternalServerErrorException(
        'STRIPE_WEBHOOK_SECRET is not configured.',
      );
    }

    return this.getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret,
    );
  }

  
  async handleStripeWebhook(event: Stripe.Event) {
    const stripe = this.getStripe();

    console.log('[Stripe webhook] Received event:', event.type);
    console.log('[Stripe webhook] Event ID:', event.id);

    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded'
    ) {
      const session = event.data.object as Stripe.Checkout.Session;

      console.log('[Stripe webhook] Checkout details:', {
        mode: session.mode,
        paymentStatus: session.payment_status,
        clientReferenceId: session.client_reference_id,
        metadataUserId: session.metadata?.userId,
        subscriptionId:
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id,
      });

      if (session.mode !== 'subscription') {
        console.log('[Stripe webhook] Skipped: not a subscription checkout.');
        return { received: true, activated: false };
      }

      if (session.payment_status !== 'paid') {
        console.log('[Stripe webhook] Skipped: payment is not paid yet.');
        return { received: true, activated: false };
      }

      const userId =
        session.metadata?.userId ?? session.client_reference_id;

      const stripeSubscriptionId =
        typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id;

      if (!userId || !stripeSubscriptionId) {
        console.error('[Stripe webhook] Missing userId or subscription ID.');
        throw new Error(
          'Checkout Session is missing its user or subscription ID.',
        );
      }

      const stripeSubscription =
        await stripe.subscriptions.retrieve(stripeSubscriptionId);

      console.log('[Stripe webhook] Stripe subscription:', {
        id: stripeSubscription.id,
        status: stripeSubscription.status,
        metadataUserId: stripeSubscription.metadata.userId,
      });

      if (stripeSubscription.status !== 'active') {
        console.log(
          '[Stripe webhook] Skipped: Stripe subscription is not active.',
        );
        return { received: true, activated: false };
      }

      // If subscription metadata exists, it must match the checkout user.
      // The signed Checkout Session remains the source of the user ID.
      const subscriptionMetadataUserId =
        stripeSubscription.metadata.userId;

      if (
        subscriptionMetadataUserId &&
        subscriptionMetadataUserId !== userId
      ) {
        console.error('[Stripe webhook] User ID mismatch:', {
          checkoutUserId: userId,
          subscriptionUserId: subscriptionMetadataUserId,
        });

        throw new Error('Stripe subscription user ID mismatch.');
      }

      const currentPeriodEnd =
        this.getSubscriptionPeriodEnd(stripeSubscription);

      await this.db.transaction(async (tx) => {
        const [matchingSubscription] = await tx
          .select()
          .from(subscriptions)
          .where(
            eq(
              subscriptions.providerSubscriptionId,
              stripeSubscriptionId,
            ),
          )
          .limit(1);

        const [existing] = matchingSubscription
          ? [matchingSubscription]
          : await tx
              .select()
              .from(subscriptions)
              .where(eq(subscriptions.userId, userId))
              .orderBy(desc(subscriptions.createdAt))
              .limit(1);

        if (existing) {
          await tx
            .update(subscriptions)
            .set({
              plan: 'PAID',
              status: 'ACTIVE',
              providerSubscriptionId: stripeSubscriptionId,
              currentPeriodEnd,
              updatedAt: new Date(),
            })
            .where(eq(subscriptions.id, existing.id));

          console.log('[Stripe webhook] Updated subscription row:', {
            id: existing.id,
            userId,
            plan: 'PAID',
            status: 'ACTIVE',
          });
        } else {
          const [created] = await tx
            .insert(subscriptions)
            .values({
              userId,
              plan: 'PAID',
              status: 'ACTIVE',
              providerSubscriptionId: stripeSubscriptionId,
              currentPeriodEnd,
            })
            .returning();
console.log('[Stripe webhook] Finished DB transaction', {
  userId,
  stripeSubscriptionId,
});
          console.log('[Stripe webhook] Created subscription row:', {
            id: created?.id,
            userId,
            plan: 'PAID',
            status: 'ACTIVE',
          });
        }
      });

      return { received: true, activated: true };
    }

    if (
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const stripeSubscription =
        event.data.object as Stripe.Subscription;

      const status =
        stripeSubscription.status === 'active'
          ? 'ACTIVE'
          : stripeSubscription.status === 'canceled'
            ? 'CANCELLED'
            : stripeSubscription.status === 'incomplete_expired'
              ? 'EXPIRED'
              : 'PENDING';


console.log('[Stripe webhook] Before DB transaction:', {
  userId: stripeSubscription.metadata.userId,
  stripeSubscriptionId: stripeSubscription.id,
  stripeStatus: stripeSubscription.status,
  currentPeriodEnd:stripeSubscription.metadata.current_period_end,
});
      const updatedRows = await this.db
        .update(subscriptions)
        .set({
          status,
          currentPeriodEnd:
            this.getSubscriptionPeriodEnd(stripeSubscription),
          updatedAt: new Date(),
        })
        .where(
          eq(
            subscriptions.providerSubscriptionId,
            stripeSubscription.id,
          ),
        )
        .returning({ id: subscriptions.id });

      console.log('[Stripe webhook] Subscription status event:', {
        stripeSubscriptionId: stripeSubscription.id,
        status,
        updatedRows: updatedRows.length,
      });
    }

    return { received: true };
  }

  

async syncCheckoutSession(userId: string, sessionId: string) {
  if (!sessionId?.trim()) {
    throw new BadRequestException('Checkout session ID is required.');
  }

  const stripe = this.getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (
    session.mode !== 'subscription' ||
    session.status !== 'complete' ||
    session.payment_status !== 'paid'
  ) {
    throw new ConflictException(
      'The checkout session is not a completed, paid subscription.',
    );
  }

  const sessionUserId =
    session.metadata?.userId ?? session.client_reference_id;

  if (!sessionUserId || sessionUserId !== userId) {
    throw new ForbiddenException(
      'This checkout session does not belong to the logged-in user.',
    );
  }

  if (!session.subscription) {
    throw new ConflictException(
      'No subscription is associated with this checkout session.',
    );
  }

  const stripeSubscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription.id;

  const stripeSubscription =
    await stripe.subscriptions.retrieve(stripeSubscriptionId);

  if (stripeSubscription.status !== 'active') {
    throw new ConflictException(
      'The Stripe subscription is not active.',
    );
  }

  const subscriptionUserId = stripeSubscription.metadata?.userId;

  if (subscriptionUserId && subscriptionUserId !== userId) {
    throw new ForbiddenException(
      'The Stripe subscription does not belong to this user.',
    );
  }

  const currentPeriodEnd =
    this.getSubscriptionPeriodEnd(stripeSubscription);

  return this.db.transaction(async (tx) => {
    const [existingByStripeId] = await tx
      .select()
      .from(subscriptions)
      .where(
        eq(subscriptions.providerSubscriptionId, stripeSubscription.id),
      )
      .limit(1);

    if (existingByStripeId) {
      const [updated] = await tx
        .update(subscriptions)
        .set({
          plan: 'PAID',
          status: 'ACTIVE',
          currentPeriodEnd,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, existingByStripeId.id))
        .returning();

      return { activated: true, subscription: updated };
    }

    const [existingForUser] = await tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    if (existingForUser) {
      const [updated] = await tx
        .update(subscriptions)
        .set({
          plan: 'PAID',
          status: 'ACTIVE',
          providerSubscriptionId: stripeSubscription.id,
          currentPeriodEnd,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, existingForUser.id))
        .returning();

      return { activated: true, subscription: updated };
    }

    const [created] = await tx
      .insert(subscriptions)
      .values({
        userId,
        plan: 'PAID',
        status: 'ACTIVE',
        providerSubscriptionId: stripeSubscription.id,
        currentPeriodEnd,
      })
      .returning();

    return { activated: true, subscription: created };
  });
}



}


