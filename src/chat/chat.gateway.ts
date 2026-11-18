
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';

import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

import { ChatService } from './chat.service';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
  ) {}

  // Authenticate socket using the existing HTTP-only cookie
  afterInit(server: Server) {
  server.use(async (client, next) => {
    try {
      const cookieHeader = client.handshake.headers.cookie;

      if (!cookieHeader) {
        return next(new Error('Unauthorized'));
      }

      const cookies = this.parseCookies(cookieHeader);

      const token = cookies['access_token'];

      if (!token) {
        return next(new Error('Unauthorized'));
      }

      const payload = await this.jwtService.verifyAsync(token);

      if (!payload.sub) {
        return next(new Error('Invalid token'));
      }

      client.data.userId = payload.sub;

      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });
}

handleConnection(client: Socket) {
  console.log('Authenticated socket connected:', client.id);
}



  handleDisconnect(client: Socket) {
    console.log('Socket disconnected:', client.id);
  }

  // Join a conversation
  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    try {
      const userId = client.data.userId;

      if (!userId) {
        throw new WsException('Unauthorized');
      }

      const conversation =
        await this.chatService.assertConversationAccess(
          data.conversationId,
          userId,
        );

      const room = `conversation:${conversation.id}`;

      await client.join(room);

      return {
        success: true,
        conversationId: conversation.id,
        message: 'Joined conversation successfully',
      };

    } catch (error) {
      if (error instanceof WsException) throw error;

      throw new WsException(
        'Unable to join conversation',
      );
    }
  }

  // Send a message
  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      conversationId: string;
      content: string;
    },
  ) {
    try {
      const userId = client.data.userId;

      if (!userId) {
        throw new WsException('Unauthorized');
      }

      if (
        typeof data?.content !== 'string' ||
        !data.content.trim() ||
        data.content.trim().length > 5000
      ) {
        throw new WsException('Invalid message content');
      }

      const message = await this.chatService.sendMessage(
        data.conversationId,
        userId,
        data.content,
      );

      const room = `conversation:${data.conversationId}`;

      // Automatically join sender to the conversation room
      await client.join(room);

      // Broadcast saved message to everyone in the room
      this.server.to(room).emit('new_message', message);

      return {
        success: true,
        message,
      };

    } catch (error) {
      if (error instanceof WsException) throw error;

      throw new WsException(
        'Unable to send message',
      );
    }
  }

  // Typing indicator
  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    try {
      const userId = client.data.userId;

      if (!userId) {
        throw new WsException('Unauthorized');
      }

      await this.chatService.assertConversationAccess(
        data.conversationId,
        userId,
      );

      const room = `conversation:${data.conversationId}`;

      // Only notify other participants
      client.to(room).emit('typing', {
        conversationId: data.conversationId,
        userId,
      });

    } catch (error) {
      if (error instanceof WsException) throw error;

      throw new WsException('Unable to send typing event');
    }
  }

  // Parse HTTP cookies
  private parseCookies(cookieHeader: string) {
    return Object.fromEntries(
      cookieHeader.split(';').map((cookie) => {
        const separatorIndex = cookie.indexOf('=');

        if (separatorIndex === -1) {
          return [cookie.trim(), ''];
        }

        const name = cookie.slice(0, separatorIndex).trim();
        const value = cookie.slice(separatorIndex + 1).trim();

        return [name, decodeURIComponent(value)];
      }),
    );
  }
  @SubscribeMessage('leave_conversation')
async handleLeaveConversation(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { conversationId: string },
) {
  await this.chatService.assertConversationAccess(
    data.conversationId,
    client.data.userId,
  );

  await client.leave(`conversation:${data.conversationId}`);

  return { success: true };
}
}
