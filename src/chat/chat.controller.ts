import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';

import { ChatService } from './chat.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';

// Replace these imports with the actual paths/names in your project.
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // Customer creates a conversation for a company/product.
  @Post('conversations')
  createConversation(
    @Body() dto: CreateChatDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.chatService.createConversation(
      req.user.userId,
      dto.companyId,
      dto.productId,
    );
  }

  // Customer gets their own conversations.
  @Get('my-conversations')
  getCustomerConversations(
    @Req() req: { user: { userId: string } },
  ) {
    return this.chatService.getCustomerConversations(req.user.userId);
  }

  // Company admin gets conversations with customer details.
  @Get('company/:companyId')
  getCompanyConversations(
    @Param('companyId') companyId: string,
    @Req() req: { user: { userId: string } },
  ) {
    return this.chatService.getCompanyConversations(
      companyId,
      req.user.userId,
    );
  }

  // Get messages belonging to a conversation.
  @Get('conversations/:conversationId/messages')
  getConversationMessages(
    @Param('conversationId') conversationId: string,
    @Req() req: { user: { userId: string } },
  ) {
    return this.chatService.getConversationMessages(
      conversationId,
      req.user.userId,
    );
  }

  // Send a message through HTTP (Socket.IO can also handle sending).
  @Post('conversations/:conversationId/messages')
  sendMessage(
    @Param('conversationId') conversationId: string,
    @Body() dto: SendMessageDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.chatService.sendMessage(
      conversationId,
      req.user.userId,
      dto.content,
    );
  }

  // Close a conversation.
  @Patch('conversations/:conversationId/close')
  closeConversation(
    @Param('conversationId') conversationId: string,
    @Req() req: { user: { userId: string } },
  ) {
    return this.chatService.closeConversation(
      conversationId,
      req.user.userId,
    );
  }
}