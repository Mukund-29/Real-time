export interface Task {
  id: string;
  title: string;
  description: string;
  column: 'todo' | 'in-progress' | 'done';
  order: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  color: string;
  connectedAt: string;
}

export interface WebSocketMessage {
  type: string;
  payload: any;
  userId?: string;
  timestamp?: number;
}

export interface ConflictResolution {
  resolved: boolean;
  task: Task;
  conflictType: 'move+edit' | 'move+move' | 'reorder';
  message?: string;
}

export interface QueuedAction {
  id: string;
  type: 'create' | 'update' | 'move' | 'delete' | 'reorder';
  payload: any;
  timestamp: number;
}
