import { CreateChatDto } from './dto/create-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';

import { eq, and, desc, isNull } from 'drizzle-orm';

import { conversations, messages, products, companyMemberships, users } from '../db/schema';


import { DRIZZLE } from '../db/db.constants';

@Injectable()
export class ChatService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: any,
  ) {}

  // Create a conversation
async createConversation(
  customerId: string,
  companyId: string,
  productId?: string,
) {
  if (!customerId) {
    throw new UnauthorizedException('Customer ID is missing');
  }

  // Look for an existing open conversation
  const conditions = [
    eq(conversations.customerId, customerId),
    eq(conversations.companyId, companyId),
    eq(conversations.status, 'OPEN'),
    productId
      ? eq(conversations.productId, productId)
      : isNull(conversations.productId),
  ];

  const [existingConversation] = await this.db
    .select()
    .from(conversations)
    .where(and(...conditions))
    .orderBy(desc(conversations.createdAt))
    .limit(1);

  // Reuse it instead of creating another one
  if (existingConversation) {
    return existingConversation;
  }

  // Create a new conversation only if none exists
  const [conversation] = await this.db
    .insert(conversations)
    .values({
      customerId,
      companyId,
      productId: productId ?? null,
      status: 'OPEN',
    })
    .returning();

  return conversation;
}

  // Get customer's conversations
  async getCustomerConversations(customerId: string) {
    return this.db
      .select()
      .from(conversations)
      .where(eq(conversations.customerId, customerId))
      .orderBy(desc(conversations.lastMessageAt));
  }

  // Get company's conversations
async getCompanyConversations(
  companyId: string,
  userId: string,
) {
  await this.verifyCompanyAdmin(companyId, userId);

  return this.db
    .select({
      id: conversations.id,
      companyId: conversations.companyId,
      customerId: conversations.customerId,
      productId: conversations.productId,
      status: conversations.status,
      lastMessageAt: conversations.lastMessageAt,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,

      customer: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    })
    .from(conversations)
    .leftJoin(users, eq(conversations.customerId, users.id))
    .where(eq(conversations.companyId, companyId))
    .orderBy(desc(conversations.lastMessageAt));
}

  // Get messages
  async getConversationMessages(
    conversationId: string,
    userId: string,
  ) {
    const conversation = await this.getConversation(conversationId);

    await this.verifyConversationAccess(conversation, userId);

    return this.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
  }

  // Send a message
  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
  ) {
    const conversation = await this.getConversation(conversationId);

    await this.verifyConversationAccess(conversation, senderId);

    if (conversation.status === 'CLOSED') {
      throw new BadRequestException('Conversation is closed');
    }

    const [message] = await this.db
      .insert(messages)
      .values({
        conversationId,
        senderId,
        content: content.trim(),
      })
      .returning();

    await this.db
      .update(conversations)
      .set({
        lastMessageAt: message.createdAt,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId));

    return message;
  }

  // Close conversation
  async closeConversation(
    conversationId: string,
    userId: string,
  ) {
    const conversation = await this.getConversation(conversationId);

    await this.verifyConversationAccess(conversation, userId);

    const [updated] = await this.db
      .update(conversations)
      .set({
        status: 'CLOSED',
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId))
      .returning();

    return updated;
  }

  // Find conversation
  private async getConversation(conversationId: string) {
    const [conversation] = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  // Verify customer or company admin
  private async verifyConversationAccess(
    conversation: any,
    userId: string,
  ) {
    if (conversation.customerId === userId) {
      return true;
    }

    await this.verifyCompanyAdmin(
      conversation.companyId,
      userId,
    );

    return true;
  }

  // Verify company admin
  private async verifyCompanyAdmin(
    companyId: string,
    userId: string,
  ) {
    const [membership] = await this.db
      .select()
      .from(companyMemberships)
      .where(
        and(
          eq(companyMemberships.companyId, companyId),
          eq(companyMemberships.userId, userId),
          eq(companyMemberships.role, 'ADMIN'),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new ForbiddenException(
        'You do not have permission to access this company chat',
      );
    }

    return membership;
  }

  async assertConversationAccess(
  conversationId: string,
  userId: string,
) {
  const conversation = await this.getConversation(conversationId);

  await this.verifyConversationAccess(conversation, userId);

  return conversation;
}
}