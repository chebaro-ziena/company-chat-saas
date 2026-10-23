
import {
  Controller,
  Get,
  Post,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
  };
}

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @Get('plans')
  getPlans() {
    return this.subscriptionsService.getPlans();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMySubscription(@Req() req: AuthenticatedRequest) {
    return this.subscriptionsService.getMySubscription(
      req.user.userId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('free')
  activateFreePlan(@Req() req: AuthenticatedRequest) {
    return this.subscriptionsService.activateFreePlan(
      req.user.userId,
    );
  }
}

