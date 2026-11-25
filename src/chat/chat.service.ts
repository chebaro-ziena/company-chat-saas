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

import { eq, and, desc, isNull, inArray, type SQL } from 'drizzle-orm';

import { conversations, messages, products, companyMemberships, users } from '../db/schema';
import type { CompanyRole } from '../auth/interfaces/authenticated-request.interface';

// Company roles allowed to handle customer conversations.
const STAFF_ROLES: readonly CompanyRole[] = ['ADMIN', 'TEAM_MEMBER'];

export type MessageSenderRole = CompanyRole | 'CUSTOMER';

type MessageBase = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  readAt: Date | null;
  createdAt: Date;
};

type MessageWithSenderRow = MessageBase & {
  senderName: string;
  senderCompanyRole: CompanyRole | null;
};

export type MessageWithSender = MessageBase & {
  sender: { id: string; name: string; role: MessageSenderRole };
};


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
  await this.verifyCompanyStaff(companyId, userId);

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

  // Get conversation details (customer, or ADMIN/TEAM_MEMBER of the company)
  async getConversationDetails(
    conversationId: string,
    userId: string,
  ) {
    const conversation = await this.getConversation(conversationId);

    await this.verifyConversationAccess(conversation, userId);

    const [details] = await this.db
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
        product: {
          id: products.id,
          name: products.name,
        },
      })
      .from(conversations)
      .leftJoin(users, eq(conversations.customerId, users.id))
      .leftJoin(products, eq(conversations.productId, products.id))
      .where(eq(conversations.id, conversationId))
      .limit(1);

    return details;
  }

  // Get messages
  async getConversationMessages(
    conversationId: string,
    userId: string,
  ) {
    const conversation = await this.getConversation(conversationId);

    await this.verifyConversationAccess(conversation, userId);

    return this.findMessagesWithSender(
      conversation.companyId,
      eq(messages.conversationId, conversationId),
    );
  }

  // Messages plus sender { id, name, role }; role is the sender's company role, or CUSTOMER.
  private async findMessagesWithSender(
    companyId: string,
    condition: SQL,
  ): Promise<MessageWithSender[]> {
    const rows: MessageWithSenderRow[] = await this.db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        senderId: messages.senderId,
        content: messages.content,
        readAt: messages.readAt,
        createdAt: messages.createdAt,
        senderName: users.name,
        senderCompanyRole: companyMemberships.role,
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .leftJoin(
        companyMemberships,
        and(
          eq(companyMemberships.userId, messages.senderId),
          eq(companyMemberships.companyId, companyId),
        ),
      )
      .where(condition)
      .orderBy(messages.createdAt);

    return rows.map(({ senderName, senderCompanyRole, ...message }) => ({
      ...message,
      sender: {
        id: message.senderId,
        name: senderName,
        role: senderCompanyRole ?? 'CUSTOMER',
      },
    }));
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

    const [messageWithSender] = await this.findMessagesWithSender(
      conversation.companyId,
      eq(messages.id, message.id),
    );

    return messageWithSender ?? message;
  }

  // Close conversation
  async closeConversation(
    conversationId: string,
    userId: string,
  ) {
    const conversation = await this.getConversation(conversationId);

    // Closing keeps its previous rule: the customer or a company ADMIN.
    await this.verifyConversationAccess(conversation, userId, ['ADMIN']);

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

  // Delete conversation (and its messages, via ON DELETE CASCADE).
  // Only a company ADMIN may delete — not the customer, not a TEAM_MEMBER.
  async deleteConversation(
    conversationId: string,
    userId: string,
  ): Promise<{ conversationId: string; companyId: string }> {
    const conversation = await this.getConversation(conversationId);

    await this.verifyCompanyStaff(conversation.companyId, userId, ['ADMIN']);

    await this.db
      .delete(conversations)
      .where(eq(conversations.id, conversationId));

    return {
      conversationId,
      companyId: conversation.companyId,
    };
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

  // Verify the user is the conversation's customer or staff of its company
  private async verifyConversationAccess(
    conversation: { customerId: string; companyId: string },
    userId: string,
    allowedRoles: readonly CompanyRole[] = STAFF_ROLES,
  ) {
    if (conversation.customerId === userId) {
      return true;
    }

    await this.verifyCompanyStaff(
      conversation.companyId,
      userId,
      allowedRoles,
    );

    return true;
  }

  // Verify company membership with one of the allowed roles (DB is the source of truth)
  private async verifyCompanyStaff(
    companyId: string,
    userId: string,
    allowedRoles: readonly CompanyRole[] = STAFF_ROLES,
  ) {
    const [membership] = await this.db
      .select()
      .from(companyMemberships)
      .where(
        and(
          eq(companyMemberships.companyId, companyId),
          eq(companyMemberships.userId, userId),
          inArray(companyMemberships.role, [...allowedRoles]),
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