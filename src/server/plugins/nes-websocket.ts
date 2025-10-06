import Hapi from '@hapi/hapi';
import Nes from '@hapi/nes';

interface WebSocketMessage {
  id?: string;
  type: string;
  content?: string;
  query?: string;
  persona_type?: string;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
}

export const nesWebSocketPlugin: Hapi.Plugin<{}> = {
  name: 'nes-websocket',
  register: async (server: Hapi.Server): Promise<void> => {
    // Register Nes plugin for WebSocket support
    await server.register({
      plugin: Nes,
      options: {
        onConnection: (socket) => {
          console.log('New WebSocket connection established via Nes');

          // Send welcome message
          socket.send({
            id: generateId(),
            type: 'status',
            content: 'Connected to AI agent service',
            timestamp: new Date(),
            metadata: { status: 'connected' },
          });
        },
        onDisconnection: () => {
          console.log('WebSocket connection closed via Nes');
        },

        onMessage: async (_socket, message: unknown) => {
          try {
            console.log('Received WebSocket message:', message);

            // Type guard to ensure message has the expected structure
            if (!message || typeof message !== 'object') {
              throw new Error('Invalid message format');
            }

            const typedMessage = message as WebSocketMessage;

            // Handle different message types
            if (typedMessage.type === 'ping') {
              return {
                id: generateId(),
                type: 'pong',
                content: 'pong',
                timestamp: new Date(),
                metadata: {},
              };
            } else if (typedMessage.type === 'query') {
              // Handle chat queries with mock responses
              const response = await handleChatQuery(typedMessage);
              return response;
            } else {
              // Handle unknown message types
              return {
                id: generateId(),
                type: 'error',
                content: 'Unknown message type',
                timestamp: new Date(),
                metadata: { error: 'Unknown message type' },
              };
            }
          } catch (error) {
            console.error('Error handling WebSocket message:', error);
            return {
              id: generateId(),
              type: 'error',
              content: 'Error processing message',
              timestamp: new Date(),
              metadata: { error: (error as Error).message },
            };
          }
        },
      },
    });

    // Add WebSocket route for chat messages
    server.subscription('/ws/synthetic-agents', {
      filter: () => {
        // Allow all messages for now
        return true;
      },
      onSubscribe: (_, path) => {
        console.log('Client subscribed to WebSocket endpoint:', path);
        return true;
      },
      onUnsubscribe: (_, path) => {
        console.log('Client unsubscribed from WebSocket endpoint:', path);
        return true;
      },
    });
  },
};

/**
 * Handles chat queries with mock AI responses
 */
async function handleChatQuery(message: WebSocketMessage): Promise<WebSocketMessage> {
  // Extract query content from either 'query' or 'content' field for backward compatibility
  const queryContent = message.query || message.content || '';
  const query = queryContent.toLowerCase();
  const personaType = message.persona_type || 'query_all';

  let response = '';

  // Simple mock responses based on query content
  if (query.includes('compliance') || query.includes('framework')) {
    response =
      'Compliance frameworks are structured approaches to ensuring organizations meet regulatory requirements and industry standards. Key frameworks include ISO 27001 for information security, GDPR for data protection, and SOC 2 for service organizations. These frameworks provide guidelines, controls, and processes to help organizations maintain compliance and manage risks effectively.';
  } else if (query.includes('hello') || query.includes('hi')) {
    response =
      "Hello! I'm an AI assistant designed to help with governance and compliance questions. How can I assist you today?";
  } else if (query.includes('help')) {
    response =
      'I can help you with questions about compliance frameworks, governance models, regulatory requirements, and best practices. Feel free to ask me anything related to these topics!';
  } else if (query.includes('security')) {
    response =
      'Security is a critical aspect of governance and compliance. It involves protecting information assets, implementing access controls, monitoring systems, and ensuring data integrity. Key areas include network security, application security, data protection, and incident response.';
  } else if (query.includes('risk')) {
    response =
      'Risk management is fundamental to effective governance. It involves identifying, assessing, and mitigating risks that could impact organizational objectives. This includes operational risks, financial risks, compliance risks, and strategic risks.';
  } else {
    response =
      "Thank you for your question. I'm a specialized AI assistant focused on governance and compliance topics. Could you please rephrase your question or ask about compliance frameworks, governance models, or regulatory requirements?";
  }

  // Simulate processing delay
  await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000 + 500));

  return {
    id: generateId(),
    type: 'response',
    content: response,
    timestamp: new Date(),
    metadata: {
      originalQuery: queryContent,
      personaType: personaType,
      processingTime: Math.random() * 1000 + 500,
    },
  };
}

/**
 * Generates a unique ID for messages
 */
function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}
