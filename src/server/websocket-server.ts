import WebSocket from 'ws';
import { WebSocketMessage } from '../client/types/websocket';

/**
 * Simple WebSocket server for development purposes
 * Handles chat messages and provides mock AI responses
 */
export class WebSocketServer {
  private wss: WebSocket.Server | null = null;
  private port: number;

  constructor(port: number = 8080) {
    this.port = port;
  }

  /**
   * Starts the WebSocket server
   */
  start(): void {
    this.wss = new WebSocket.Server({
      port: this.port,
      path: '/ws/synthetic-agents',
    });

    const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
    console.log(`WebSocket server started on ws://${host}:${this.port}/ws/synthetic-agents`);

    this.wss.on('connection', (ws) => {
      console.log('New WebSocket connection established');

      // Handle incoming messages
      ws.on('message', (data) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          console.log('Received message:', message);

          // Handle different message types
          if (message.type === 'ping') {
            // Respond to ping with pong
            ws.send(
              JSON.stringify({
                id: this.generateId(),
                type: 'pong',
                content: 'pong',
                timestamp: new Date(),
                metadata: {},
              })
            );
          } else if (message.type === 'query') {
            // Handle chat queries with mock responses
            this.handleChatQuery(ws, message);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          ws.send(
            JSON.stringify({
              id: this.generateId(),
              type: 'error',
              content: 'Invalid message format',
              timestamp: new Date(),
              metadata: { error: 'Invalid message format' },
            })
          );
        }
      });

      // Handle connection close
      ws.on('close', (code, reason) => {
        console.log(`WebSocket connection closed: ${code} ${reason}`);
      });

      // Handle connection errors
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });

      // Send welcome message
      ws.send(
        JSON.stringify({
          id: this.generateId(),
          type: 'status',
          content: 'Connected to AI agent service',
          timestamp: new Date(),
          metadata: { status: 'connected' },
        })
      );
    });

    this.wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });
  }

  /**
   * Handles chat queries with mock AI responses
   */
  private handleChatQuery(ws: WebSocket, message: WebSocketMessage): void {
    const query = message.content.toLowerCase();
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
    setTimeout(
      () => {
        const responseMessage: WebSocketMessage = {
          id: this.generateId(),
          type: 'response',
          content: response,
          timestamp: new Date(),
          metadata: {
            originalQuery: message.content,
            processingTime: Math.random() * 1000 + 500, // 500-1500ms
          },
        };

        ws.send(JSON.stringify(responseMessage));
      },
      Math.random() * 1000 + 500
    ); // Random delay between 500-1500ms
  }

  /**
   * Stops the WebSocket server
   */
  stop(): void {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
      console.log('WebSocket server stopped');
    }
  }

  /**
   * Generates a unique ID for messages
   */
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}
