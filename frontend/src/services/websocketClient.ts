import { Task, User, WebSocketMessage, QueuedAction } from '../types';

type MessageHandler = (message: WebSocketMessage) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private messageHandlers: Set<MessageHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private isConnected = false;
  private actionQueue: QueuedAction[] = [];
  private user: User | null = null;

  constructor(url: string) {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = process.env.REACT_APP_WS_URL || `${protocol}//${window.location.hostname}:3001`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.replayQueuedActions();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.isConnected = false;
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        this.connect().catch(console.error);
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('Max reconnect attempts reached');
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    // Handle connection message
    if (message.type === 'connected') {
      this.user = message.payload.user;
    }

    // Broadcast to all handlers
    this.messageHandlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('Error in message handler:', error);
      }
    });
  }

  send(message: WebSocketMessage): void {
    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue action for later replay
      this.queueAction(message);
    }
  }

  private queueAction(message: WebSocketMessage): void {
    const action: QueuedAction = {
      id: `${Date.now()}-${Math.random()}`,
      type: this.getMessageType(message.type),
      payload: message.payload,
      timestamp: Date.now(),
    };
    this.actionQueue.push(action);
    console.log('Action queued (offline):', action);
  }

  private getMessageType(type: string): QueuedAction['type'] {
    if (type === 'create-task') return 'create';
    if (type === 'update-task') return 'update';
    if (type === 'move-task') return 'move';
    if (type === 'delete-task') return 'delete';
    if (type === 'reorder-task') return 'reorder';
    return 'update';
  }

  private replayQueuedActions(): void {
    if (this.actionQueue.length === 0) return;

    console.log(`Replaying ${this.actionQueue.length} queued actions...`);
    const actions = [...this.actionQueue];
    this.actionQueue = [];

    actions.forEach(action => {
      const messageType = this.getWebSocketMessageType(action.type);
      this.send({
        type: messageType,
        payload: action.payload,
      });
    });
  }

  private getWebSocketMessageType(actionType: QueuedAction['type']): string {
    const mapping: Record<QueuedAction['type'], string> = {
      create: 'create-task',
      update: 'update-task',
      move: 'move-task',
      delete: 'delete-task',
      reorder: 'reorder-task',
    };
    return mapping[actionType] || 'update-task';
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getUser(): User | null {
    return this.user;
  }

  getQueuedActionsCount(): number {
    return this.actionQueue.length;
  }
}
