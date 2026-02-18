import { Database } from '../db/database';
import { Task, TaskCreatePayload, TaskUpdatePayload, TaskMovePayload, ConflictResolution } from '../types';
import { FractionalIndex } from '../utils/fractionalIndexing';
import { v4 as uuidv4 } from 'uuid';

export class TaskService {
  constructor(private db: Database) {}

  async getAllTasks(): Promise<Task[]> {
    return this.db.getAllTasks();
  }

  async getTaskById(id: string): Promise<Task | null> {
    return this.db.getTaskById(id);
  }

  async createTask(payload: TaskCreatePayload): Promise<Task> {
    const id = uuidv4();
    let order = payload.order;

    if (order === undefined) {
      // Insert at end of column
      const maxOrder = await this.db.getMaxOrderInColumn(payload.column);
      order = FractionalIndex.generateBetween(maxOrder, null);
    }

    const task: Omit<Task, 'createdAt' | 'updatedAt'> = {
      id,
      title: payload.title,
      description: payload.description,
      column: payload.column,
      order,
      version: 1,
    };

    return this.db.createTask(task);
  }

  async updateTask(payload: TaskUpdatePayload): Promise<{ task: Task | null; conflict: ConflictResolution | null }> {
    const currentTask = await this.db.getTaskById(payload.id);
    if (!currentTask) {
      return { task: null, conflict: null };
    }

    // Check version for conflict detection
    if (currentTask.version !== payload.version) {
      // Conflict detected - need to resolve
      const conflict: ConflictResolution = {
        resolved: false,
        task: currentTask,
        conflictType: 'move+edit',
        message: 'Task was modified by another user',
      };
      return { task: null, conflict };
    }

    const updates: Partial<Pick<Task, 'title' | 'description' | 'column' | 'order'>> = {};
    if (payload.title !== undefined) updates.title = payload.title;
    if (payload.description !== undefined) updates.description = payload.description;
    if (payload.column !== undefined) updates.column = payload.column;
    if (payload.order !== undefined) updates.order = payload.order;

    try {
      const updated = await this.db.updateTask(payload.id, updates, payload.version);
      return { task: updated, conflict: null };
    } catch (error: any) {
      if (error.message === 'Version mismatch') {
        const latest = await this.db.getTaskById(payload.id);
        const conflict: ConflictResolution = {
          resolved: false,
          task: latest!,
          conflictType: 'move+edit',
          message: 'Task was modified by another user',
        };
        return { task: null, conflict };
      }
      throw error;
    }
  }

  async moveTask(payload: TaskMovePayload): Promise<{ task: Task | null; conflict: ConflictResolution | null }> {
    const currentTask = await this.db.getTaskById(payload.id);
    if (!currentTask) {
      return { task: null, conflict: null };
    }

    // Check version
    if (currentTask.version !== payload.version) {
      const conflict: ConflictResolution = {
        resolved: false,
        task: currentTask,
        conflictType: 'move+move',
        message: 'Task was moved by another user',
      };
      return { task: null, conflict };
    }

    // Calculate new order if not provided
    let newOrder = payload.newOrder;
    if (newOrder === undefined) {
      const tasksInColumn = await this.db.getAllTasks();
      const columnTasks = tasksInColumn
        .filter(t => t.column === payload.newColumn && t.id !== payload.id)
        .sort((a, b) => a.order - b.order);

      if (columnTasks.length === 0) {
        newOrder = FractionalIndex.generateBetween(null, null);
      } else {
        newOrder = FractionalIndex.generateBetween(
          columnTasks[columnTasks.length - 1].order,
          null
        );
      }
    }

    try {
      const updated = await this.db.updateTask(
        payload.id,
        { column: payload.newColumn, order: newOrder },
        payload.version
      );
      return { task: updated, conflict: null };
    } catch (error: any) {
      if (error.message === 'Version mismatch') {
        const latest = await this.db.getTaskById(payload.id);
        const conflict: ConflictResolution = {
          resolved: false,
          task: latest!,
          conflictType: 'move+move',
          message: 'Task was moved by another user',
        };
        return { task: null, conflict };
      }
      throw error;
    }
  }

  async reorderTask(
    taskId: string,
    newOrder: number,
    version: number
  ): Promise<{ task: Task | null; conflict: ConflictResolution | null }> {
    const currentTask = await this.db.getTaskById(taskId);
    if (!currentTask) {
      return { task: null, conflict: null };
    }

    if (currentTask.version !== version) {
      const conflict: ConflictResolution = {
        resolved: false,
        task: currentTask,
        conflictType: 'reorder',
        message: 'Task order was changed by another user',
      };
      return { task: null, conflict };
    }

    try {
      const updated = await this.db.updateTask(
        taskId,
        { order: newOrder },
        version
      );
      return { task: updated, conflict: null };
    } catch (error: any) {
      if (error.message === 'Version mismatch') {
        const latest = await this.db.getTaskById(taskId);
        const conflict: ConflictResolution = {
          resolved: false,
          task: latest!,
          conflictType: 'reorder',
          message: 'Task order was changed by another user',
        };
        return { task: null, conflict };
      }
      throw error;
    }
  }

  async deleteTask(id: string): Promise<boolean> {
    return this.db.deleteTask(id);
  }

  /**
   * Resolve conflict by applying the latest version and merging changes
   */
  async resolveConflict(
    taskId: string,
    clientVersion: number,
    clientUpdates: Partial<Pick<Task, 'title' | 'description' | 'column' | 'order'>>
  ): Promise<Task> {
    const currentTask = await this.db.getTaskById(taskId);
    if (!currentTask) {
      throw new Error('Task not found');
    }

    // Merge: use server's latest state but apply client's non-conflicting changes
    const merged: Partial<Pick<Task, 'title' | 'description' | 'column' | 'order'>> = {
      ...currentTask,
      ...clientUpdates,
    };

    // For move conflicts, server wins (deterministic resolution)
    if (clientUpdates.column && clientUpdates.column !== currentTask.column) {
      merged.column = currentTask.column;
    }

    // For order conflicts, server wins
    if (clientUpdates.order !== undefined && clientUpdates.order !== currentTask.order) {
      merged.order = currentTask.order;
    }

    // Update with merged state
    const updated = await this.db.updateTask(taskId, merged, currentTask.version);
    return updated!;
  }
}
