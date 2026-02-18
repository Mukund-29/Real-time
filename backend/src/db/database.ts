import { Pool, PoolClient } from 'pg';
import { Task } from '../types';
import * as fs from 'fs';
import * as path from 'path';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'taskboard',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export class Database {
  private pool: Pool;

  constructor() {
    this.pool = pool;
  }

  async initialize(): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Read and execute schema
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      await client.query(schema);
    } finally {
      client.release();
    }
  }

  async getAllTasks(): Promise<Task[]> {
    const result = await this.pool.query(
      `SELECT id, title, description, column_name as column, order_index as order, version, created_at as "createdAt", updated_at as "updatedAt"
       FROM tasks
       ORDER BY column_name, order_index`
    );
    return result.rows.map(this.mapRowToTask);
  }

  async getTaskById(id: string): Promise<Task | null> {
    const result = await this.pool.query(
      `SELECT id, title, description, column_name as column, order_index as order, version, created_at as "createdAt", updated_at as "updatedAt"
       FROM tasks
       WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToTask(result.rows[0]);
  }

  async createTask(task: Omit<Task, 'createdAt' | 'updatedAt'>): Promise<Task> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      const result = await client.query(
        `INSERT INTO tasks (id, title, description, column_name, order_index, version)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, title, description, column_name as column, order_index as order, version, created_at as "createdAt", updated_at as "updatedAt"`,
        [task.id, task.title, task.description, task.column, task.order, task.version || 1]
      );

      await client.query('COMMIT');
      return this.mapRowToTask(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateTask(
    id: string,
    updates: Partial<Pick<Task, 'title' | 'description' | 'column' | 'order'>>,
    expectedVersion: number
  ): Promise<Task | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Check version for optimistic locking
      const current = await this.getTaskById(id);
      if (!current) {
        await client.query('ROLLBACK');
        return null;
      }

      if (current.version !== expectedVersion) {
        await client.query('ROLLBACK');
        throw new Error('Version mismatch');
      }

      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.title !== undefined) {
        updateFields.push(`title = $${paramIndex++}`);
        values.push(updates.title);
      }
      if (updates.description !== undefined) {
        updateFields.push(`description = $${paramIndex++}`);
        values.push(updates.description);
      }
      if (updates.column !== undefined) {
        updateFields.push(`column_name = $${paramIndex++}`);
        values.push(updates.column);
      }
      if (updates.order !== undefined) {
        updateFields.push(`order_index = $${paramIndex++}`);
        values.push(updates.order);
      }

      updateFields.push(`version = version + 1`);
      updateFields.push(`updated_at = NOW()`);

      values.push(id, expectedVersion);

      const result = await client.query(
        `UPDATE tasks
         SET ${updateFields.join(', ')}
         WHERE id = $${paramIndex++} AND version = $${paramIndex++}
         RETURNING id, title, description, column_name as column, order_index as order, version, created_at as "createdAt", updated_at as "updatedAt"`,
        values
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      await client.query('COMMIT');
      return this.mapRowToTask(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteTask(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM tasks WHERE id = $1', [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getMaxOrderInColumn(column: string): Promise<number> {
    const result = await this.pool.query(
      `SELECT COALESCE(MAX(order_index), 0) as max_order
       FROM tasks
       WHERE column_name = $1`,
      [column]
    );
    return parseFloat(result.rows[0].max_order) || 0;
  }

  private mapRowToTask(row: any): Task {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      column: row.column,
      order: parseFloat(row.order),
      version: parseInt(row.version),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export const db = new Database();
