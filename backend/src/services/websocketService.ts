import { WebSocket } from 'ws';
import { TaskService } from './taskService';
import { User } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface ConnectedClient {
  ws: WebSocket;
  user: User;
  lastPing: number;
}

export class WebSocketService {
  private clients: Map<string, ConnectedClient> = new Map();
  private taskService: TaskService;

  constructor(taskService: TaskService) {
    this.taskService = taskService;
  }

  handleConnection(ws: WebSocket): string {
    const userId = uuidv4();
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const user: User = {
      id: userId,
      name: `User ${userId.substring(0, 8)}`,
      color: randomColor,
      connectedAt: new Date(),
    };

    const client: ConnectedClient = {
      ws,
      user,
      lastPing: Date.now(),
    };

    this.clients.set(userId, client);

    // Send initial state
    this.sendToClient(userId, {
      type: 'connected',
      payload: { user, tasks: [] },
    });

    // Load and send all tasks
    this.taskService.getAllTasks().then(tasks => {
      this.sendToClient(userId, {
        type: 'tasks-loaded',
        payload: { tasks },
      });
    });

    // Broadcast user joined
    this.broadcastToOthers(userId, {
      type: 'user-joined',
      payload: { user },
    });

    // Send list of all connected users
    this.sendUserList(userId);

    // Setup ping/pong for connection health
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
        client.lastPing = Date.now();
      } else {
        clearInterval(pingInterval);
      }
    }, 30000);

    ws.on('close', () => {
      clearInterval(pingInterval);
      this.handleDisconnection(userId);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for user ${userId}:`, error);
      this.handleDisconnection(userId);
    });

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleMessage(userId, message);
      } catch (error) {
        console.error('Error handling message:', error);
        this.sendToClient(userId, {
          type: 'error',
          payload: { message: 'Invalid message format' },
        });
      }
    });

    return userId;
  }

  private async handleMessage(userId: string, message: any): Promise<void> {
    const { type, payload } = message;

    switch (type) {
      case 'create-task':
        await this.handleCreateTask(userId, payload);
        break;

      case 'update-task':
        await this.handleUpdateTask(userId, payload);
        break;

      case 'move-task':
        await this.handleMoveTask(userId, payload);
        break;

      case 'reorder-task':
        await this.handleReorderTask(userId, payload);
        break;

      case 'delete-task':
        await this.handleDeleteTask(userId, payload);
        break;

      case 'resolve-conflict':
        await this.handleResolveConflict(userId, payload);
        break;

      default:
        this.sendToClient(userId, {
          type: 'error',
          payload: { message: `Unknown message type: ${type}` },
        });
    }
  }

  private async handleCreateTask(userId: string, payload: any): Promise<void> {
    try {
      const task = await this.taskService.createTask(payload);
      this.broadcastToAll({
        type: 'task-created',
        payload: { task, userId },
      });
    } catch (error: any) {
      this.sendToClient(userId, {
        type: 'error',
        payload: { message: error.message },
      });
    }
  }

  private async handleUpdateTask(userId: string, payload: any): Promise<void> {
    try {
      const result = await this.taskService.updateTask(payload);
      
      if (result.conflict) {
        // Send conflict notification to the user who made the change
        this.sendToClient(userId, {
          type: 'conflict-detected',
          payload: {
            conflict: result.conflict,
            originalPayload: payload,
          },
        });
      } else if (result.task) {
        // Broadcast update to all clients
        this.broadcastToAll({
          type: 'task-updated',
          payload: { task: result.task, userId },
        });
      }
    } catch (error: any) {
      this.sendToClient(userId, {
        type: 'error',
        payload: { message: error.message },
      });
    }
  }

  private async handleMoveTask(userId: string, payload: any): Promise<void> {
    try {
      const result = await this.taskService.moveTask(payload);
      
      if (result.conflict) {
        this.sendToClient(userId, {
          type: 'conflict-detected',
          payload: {
            conflict: result.conflict,
            originalPayload: payload,
          },
        });
      } else if (result.task) {
        this.broadcastToAll({
          type: 'task-moved',
          payload: { task: result.task, userId },
        });
      }
    } catch (error: any) {
      this.sendToClient(userId, {
        type: 'error',
        payload: { message: error.message },
      });
    }
  }

  private async handleReorderTask(userId: string, payload: any): Promise<void> {
    try {
      const result = await this.taskService.reorderTask(
        payload.taskId,
        payload.newOrder,
        payload.version
      );
      
      if (result.conflict) {
        this.sendToClient(userId, {
          type: 'conflict-detected',
          payload: {
            conflict: result.conflict,
            originalPayload: payload,
          },
        });
      } else if (result.task) {
        this.broadcastToAll({
          type: 'task-reordered',
          payload: { task: result.task, userId },
        });
      }
    } catch (error: any) {
      this.sendToClient(userId, {
        type: 'error',
        payload: { message: error.message },
      });
    }
  }

  private async handleDeleteTask(userId: string, payload: any): Promise<void> {
    try {
      const deleted = await this.taskService.deleteTask(payload.id);
      if (deleted) {
        this.broadcastToAll({
          type: 'task-deleted',
          payload: { taskId: payload.id, userId },
        });
      }
    } catch (error: any) {
      this.sendToClient(userId, {
        type: 'error',
        payload: { message: error.message },
      });
    }
  }

  private async handleResolveConflict(userId: string, payload: any): Promise<void> {
    try {
      const { taskId, clientVersion, clientUpdates } = payload;
      const resolvedTask = await this.taskService.resolveConflict(
        taskId,
        clientVersion,
        clientUpdates
      );
      
      this.broadcastToAll({
        type: 'task-updated',
        payload: { task: resolvedTask, userId },
      });
    } catch (error: any) {
      this.sendToClient(userId, {
        type: 'error',
        payload: { message: error.message },
      });
    }
  }

  private sendToClient(userId: string, message: any): void {
    const client = this.clients.get(userId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  private broadcastToAll(message: any): void {
    this.clients.forEach((client, userId) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  private broadcastToOthers(excludeUserId: string, message: any): void {
    this.clients.forEach((client, userId) => {
      if (userId !== excludeUserId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  private sendUserList(userId: string): void {
    const users = Array.from(this.clients.values()).map(c => c.user);
    this.sendToClient(userId, {
      type: 'users-updated',
      payload: { users },
    });
  }

  private handleDisconnection(userId: string): void {
    const client = this.clients.get(userId);
    if (client) {
      this.clients.delete(userId);
      this.broadcastToAll({
        type: 'user-left',
        payload: { userId: client.user.id },
      });
    }
  }

  getConnectedUsers(): User[] {
    return Array.from(this.clients.values()).map(c => c.user);
  }
}
