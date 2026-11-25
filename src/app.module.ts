
import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { DbModule } from './db/db.module';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { UsersModule } from './users/users.module';
import { TeamModule } from './team/team.module';
import { ProductsModule } from './products/products.module';
import { ChatModule } from './chat/chat.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';

export const { ObserveModule, ObserveInstrument } =
  createObserveModule();

@Module({
  imports: [

    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),

    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Default: 100 requests per minute per IP across all HTTP routes
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    DbModule,

    ObserveModule.forRoot({
      appKey: 'YOUR_APP_KEY',
      appSecret: 'YOUR_APP_SECRET',
      serviceId: 'company-chat-saas',
    }),

    AuthModule,
    CompaniesModule,
    UsersModule,
    TeamModule,
    ProductsModule,
    ChatModule,
    SubscriptionsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

