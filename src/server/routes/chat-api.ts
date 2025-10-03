import Hapi from '@hapi/hapi';
import Joi from '@hapi/joi';
import { SessionService } from '../services/session-service';

const messageSchema = Joi.object({
  content: Joi.string().min(1).max(1000).required(),
  metadata: Joi.object().optional(),
});

const sessionSchema = Joi.object({
  userId: Joi.string().required(),
  metadata: Joi.object({
    userAgent: Joi.string().optional(),
    ipAddress: Joi.string().optional(),
  }).optional(),
});

const sessionIdSchema = Joi.string()
  .pattern(/^[a-f0-9]{16}$/)
  .required();
const limitSchema = Joi.number().integer().min(1).max(100).optional();

export const chatApiRoutes: Hapi.Plugin<{}> = {
  name: 'chat-api',
  register: async (server: Hapi.Server): Promise<void> => {
    // Create new session
    server.route({
      method: 'POST',
      path: '/api/v1/sessions',
      options: {
        auth: false,
        validate: {
          payload: sessionSchema,
        },
      },
      handler: async (request, h) => {
        const sessionService = request.server.app.sessionService as SessionService;
        const { userId, metadata } = request.payload as any;

        const session = await sessionService.createSession(userId, metadata || {});

        return h
          .response({
            sessionId: session.id,
            status: 'created',
            createdAt: session.createdAt,
          })
          .code(201);
      },
    });

    // Get session details
    server.route({
      method: 'GET',
      path: '/api/v1/sessions/{sessionId}',
      options: {
        validate: {
          params: Joi.object({
            sessionId: sessionIdSchema,
          }),
        },
      },
      handler: async (request, h) => {
        const sessionService = request.server.app.sessionService as SessionService;
        const { sessionId } = request.params;

        const session = await sessionService.getSession(sessionId);
        if (!session) {
          return h.response({ error: 'Session not found' }).code(404);
        }

        return h.response(session);
      },
    });

    // Get session messages
    server.route({
      method: 'GET',
      path: '/api/v1/sessions/{sessionId}/messages',
      options: {
        validate: {
          params: Joi.object({
            sessionId: sessionIdSchema,
          }),
          query: Joi.object({
            limit: limitSchema,
          }),
        },
      },
      handler: async (request, h) => {
        const sessionService = request.server.app.sessionService as SessionService;
        const { sessionId } = request.params;
        const { limit } = request.query;

        const messages = await sessionService.getMessages(sessionId, limit);
        return h.response({ messages });
      },
    });

    // Send message
    server.route({
      method: 'POST',
      path: '/api/v1/sessions/{sessionId}/messages',
      options: {
        validate: {
          params: Joi.object({
            sessionId: sessionIdSchema,
          }),
          payload: messageSchema,
        },
      },
      handler: async (request, h) => {
        const sessionService = request.server.app.sessionService as SessionService;
        const { sessionId } = request.params;
        const { content, metadata } = request.payload as any;

        // Add user message to session
        const userMessage = await sessionService.addMessage(sessionId, {
          sessionId,
          content,
          role: 'user',
          metadata: metadata || {},
          status: 'sent',
        });

        // TODO: Send to WebSocket service in Phase 3
        // For now, just return the message
        return h.response({
          message: userMessage,
          status: 'sent',
        });
      },
    });

    // Delete session
    server.route({
      method: 'DELETE',
      path: '/api/v1/sessions/{sessionId}',
      options: {
        validate: {
          params: Joi.object({
            sessionId: sessionIdSchema,
          }),
        },
      },
      handler: async (request, h) => {
        const sessionService = request.server.app.sessionService as SessionService;
        const { sessionId } = request.params;

        await sessionService.deleteSession(sessionId);
        return h.response({ status: 'deleted' });
      },
    });
  },
};
