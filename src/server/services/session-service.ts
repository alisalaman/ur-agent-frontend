import { ChatSession, ChatMessage, SessionMetadata } from '../types/session';
import { createClient, RedisClientType } from 'redis';
import { appConfig } from '../config';
import { SessionNotFoundError, RedisConnectionError } from '../types/errors';

export class SessionService {
  private redis: RedisClientType;

  constructor() {
    const redisConfig: any = {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    };

    if (process.env.REDIS_PASSWORD) {
      redisConfig.password = process.env.REDIS_PASSWORD;
    }

    this.redis = createClient(redisConfig);

    this.redis.on('error', (error) => {
      throw new RedisConnectionError(error.message);
    });

    this.redis.connect().catch((error) => {
      throw new RedisConnectionError(error.message);
    });
  }

  async createSession(userId: string, metadata: SessionMetadata): Promise<ChatSession> {
    const session: ChatSession = {
      id: this.generateId(),
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active',
      messages: [],
      metadata: {
        ...metadata,
        lastActivity: new Date(),
        messageCount: 0,
      },
    };

    await this.redis.setEx(`session:${session.id}`, appConfig.session.ttl, JSON.stringify(session));

    return session;
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    const data = await this.redis.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  async updateSession(sessionId: string, updates: Partial<ChatSession>): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    const updatedSession = {
      ...session,
      ...updates,
      updatedAt: new Date(),
    };

    await this.redis.setEx(
      `session:${sessionId}`,
      appConfig.session.ttl,
      JSON.stringify(updatedSession)
    );
  }

  async addMessage(
    sessionId: string,
    message: Omit<ChatMessage, 'id' | 'timestamp'>
  ): Promise<ChatMessage> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    const newMessage: ChatMessage = {
      ...message,
      id: this.generateId(),
      timestamp: new Date(),
    };

    session.messages.push(newMessage);
    session.metadata.lastActivity = new Date();
    session.metadata.messageCount = session.messages.length;

    await this.redis.setEx(`session:${sessionId}`, appConfig.session.ttl, JSON.stringify(session));

    return newMessage;
  }

  async getMessages(sessionId: string, limit?: number): Promise<ChatMessage[]> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return [];
    }

    const messages = session.messages.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return limit ? messages.slice(-limit) : messages;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.redis.del(`session:${sessionId}`);
  }

  async getUserSessions(userId: string): Promise<ChatSession[]> {
    const keys = await this.redis.keys(`session:*`);
    const sessions: ChatSession[] = [];

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const session: ChatSession = JSON.parse(data);
        if (session.userId === userId) {
          sessions.push(session);
        }
      }
    }

    return sessions.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  private generateId(): string {
    // Use crypto.randomBytes for secure ID generation
    const crypto = require('crypto');
    return crypto.randomBytes(8).toString('hex');
  }
}
