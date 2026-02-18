-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id VARCHAR(255) PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  column_name VARCHAR(50) NOT NULL CHECK (column_name IN ('todo', 'in-progress', 'done')),
  order_index DOUBLE PRECISION NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index on column and order for efficient queries
CREATE INDEX IF NOT EXISTS idx_tasks_column_order ON tasks(column_name, order_index);

-- Create users table for presence tracking
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(7) NOT NULL,
  connected_at TIMESTAMP NOT NULL DEFAULT NOW()
);
