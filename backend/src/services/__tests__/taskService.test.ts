import { TaskService } from '../taskService';
import { Database } from '../../db/database';
import { Task } from '../../types';

// Mock the database
jest.mock('../../db/database');

describe('TaskService', () => {
  let taskService: TaskService;
  let mockDb: jest.Mocked<Database>;

  beforeEach(() => {
    mockDb = new Database() as jest.Mocked<Database>;
    taskService = new TaskService(mockDb);
  });

  describe('createTask', () => {
    it('should create a task with generated order', async () => {
      const payload = {
        title: 'Test Task',
        description: 'Test Description',
        column: 'todo' as const,
      };

      mockDb.getMaxOrderInColumn.mockResolvedValue(0);
      mockDb.createTask.mockResolvedValue({
        id: 'test-id',
        ...payload,
        order: 0.5,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await taskService.createTask(payload);

      expect(result).toBeDefined();
      expect(result.title).toBe(payload.title);
      expect(mockDb.createTask).toHaveBeenCalled();
    });
  });

  describe('updateTask', () => {
    it('should update task when version matches', async () => {
      const currentTask: Task = {
        id: 'test-id',
        title: 'Old Title',
        description: 'Old Description',
        column: 'todo',
        order: 0.5,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.getTaskById.mockResolvedValue(currentTask);
      mockDb.updateTask.mockResolvedValue({
        ...currentTask,
        title: 'New Title',
        version: 2,
      });

      const result = await taskService.updateTask({
        id: 'test-id',
        title: 'New Title',
        version: 1,
      });

      expect(result.task).toBeDefined();
      expect(result.conflict).toBeNull();
      expect(result.task?.title).toBe('New Title');
    });

    it('should detect conflict when version mismatches', async () => {
      const currentTask: Task = {
        id: 'test-id',
        title: 'Server Title',
        description: 'Description',
        column: 'todo',
        order: 0.5,
        version: 2, // Different version
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.getTaskById.mockResolvedValue(currentTask);

      const result = await taskService.updateTask({
        id: 'test-id',
        title: 'Client Title',
        version: 1, // Client has old version
      });

      expect(result.task).toBeNull();
      expect(result.conflict).toBeDefined();
      expect(result.conflict?.conflictType).toBe('move+edit');
    });
  });

  describe('moveTask', () => {
    it('should move task when version matches', async () => {
      const currentTask: Task = {
        id: 'test-id',
        title: 'Test Task',
        description: 'Description',
        column: 'todo',
        order: 0.5,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.getTaskById.mockResolvedValue(currentTask);
      mockDb.getAllTasks.mockResolvedValue([]);
      mockDb.updateTask.mockResolvedValue({
        ...currentTask,
        column: 'in-progress',
        order: 1.5,
        version: 2,
      });

      const result = await taskService.moveTask({
        id: 'test-id',
        newColumn: 'in-progress',
        newOrder: 1.5,
        version: 1,
      });

      expect(result.task).toBeDefined();
      expect(result.conflict).toBeNull();
      expect(result.task?.column).toBe('in-progress');
    });

    it('should detect conflict when version mismatches', async () => {
      const currentTask: Task = {
        id: 'test-id',
        title: 'Test Task',
        description: 'Description',
        column: 'done', // Already moved by another user
        order: 2.5,
        version: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.getTaskById.mockResolvedValue(currentTask);

      const result = await taskService.moveTask({
        id: 'test-id',
        newColumn: 'in-progress',
        newOrder: 1.5,
        version: 1, // Client has old version
      });

      expect(result.task).toBeNull();
      expect(result.conflict).toBeDefined();
      expect(result.conflict?.conflictType).toBe('move+move');
    });
  });
});
