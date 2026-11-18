import { Module } from '@nestjs/common';

import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';

import { AuthModule } from '../auth/auth.module';
import { DbModule } from '../db/db.module';

@Module({
  imports: [
    AuthModule,
    DbModule,
  ],
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatGateway,
  ],
  exports: [
    ChatService,
    ChatGateway,
  ],
})
export class ChatModule {}
