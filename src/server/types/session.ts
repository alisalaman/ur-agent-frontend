export interface ChatSession {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'inactive' | 'archived';
  messages: ChatMessage[];
  metadata: SessionMetadata;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
  metadata: MessageMetadata;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
}

export interface SessionMetadata {
  userAgent?: string;
  ipAddress?: string;
  lastActivity?: Date;
  messageCount?: number;
}

export interface MessageMetadata {
  agentType?: 'BankRep' | 'TradeBodyRep' | 'PaymentsEcosystemRep';
  confidence?: number;
  processingTime?: number;
  error?: string;
  simulated?: boolean;
}
