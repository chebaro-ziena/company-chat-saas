
import * as common from '@nestjs/common';
import { Request } from 'express';
import type Stripe from 'stripe';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
  };
}

@common.Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @common.Get('plans')
  getPlans() {
    return this.subscriptionsService.getPlans();
  }

  @common.UseGuards(JwtAuthGuard)
  @common.Get('me')
  getMySubscription(@common.Req() req: AuthenticatedRequest) {
    return this.subscriptionsService.getMySubscription(
      req.user.userId,
    );
  }

  @common.UseGuards(JwtAuthGuard)
  @common.Post('free')
  activateFreePlan(@common.Req() req: AuthenticatedRequest) {
    return this.subscriptionsService.activateFreePlan(
      req.user.userId,
    );
  }


  @common.UseGuards(JwtAuthGuard)
  @common.Post('checkout')
  createPaidCheckout(@common.Req() req: AuthenticatedRequest) {
    return this.subscriptionsService.createPaidCheckoutSession(
      req.user.userId,
    );
  }

@common.Post('webhook')
async handleStripeWebhook(
  @common.Headers('stripe-signature') signature: string,
  @common.Req() req: common.RawBodyRequest<Request>,
) {console.log('[Webhook controller] Request received');

  console.log('[Webhook controller] Request received');
console.log('[Webhook controller] Signature exists:', !!signature);
console.log('[Webhook controller] Raw body exists:', !!req.rawBody);
  if (!signature || !req.rawBody) {
    throw new common.BadRequestException(
      'Missing Stripe signature or raw request body.',
    );
  }

    let event: Stripe.Event;

    try {
      event = this.subscriptionsService.constructStripeEvent(
        req.rawBody,
        signature,
      );
      console.log('[Webhook controller] Event type:', event.type);
    } catch {
      throw new common.BadRequestException(
        'Invalid Stripe webhook signature.',
      );
    }

    return this.subscriptionsService.handleStripeWebhook(event);
  }

@common.UseGuards(JwtAuthGuard)
@common.Post('sync-checkout')
syncCheckout(
  @common.Req() req: AuthenticatedRequest,
  @common.Body('sessionId') sessionId: string,
) {
  return this.subscriptionsService.syncCheckoutSession(
    req.user.userId,
    sessionId,
  );
}
 
}

