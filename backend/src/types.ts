export interface Task {
  id: string;
  title: string;
  description: string;
  column: 'todo' | 'in-progress' | 'done';
  order: number; // Fractional index for O(1) ordering
  createdAt: Date;
  updatedAt: Date;
  version: number; // For conflict resolution
}

export interface User {
  id: string;
  name: string;
  color: string;
  connectedAt: Date;
}

export interface WebSocketMessage {
  type: string;
  payload: any;
  userId?: string;
  timestamp?: number;
}

export interface TaskCreatePayload {
  title: string;
  description: string;
  column: 'todo' | 'in-progress' | 'done';
  order?: number;
}

export interface TaskUpdatePayload {
  id: string;
  title?: string;
  description?: string;
  column?: 'todo' | 'in-progress' | 'done';
  order?: number;
  version: number;
}

export interface TaskMovePayload {
  id: string;
  newColumn: 'todo' | 'in-progress' | 'done';
  newOrder: number;
  version: number;
}

export interface ConflictResolution {
  resolved: boolean;
  task: Task;
  conflictType: 'move+edit' | 'move+move' | 'reorder';
  message?: string;
}
