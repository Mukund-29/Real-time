-- ============================================================================
-- Real-Time Collaborative Task Board - Database Schema
-- ============================================================================
-- This schema creates all necessary tables for the task board application
-- Run this script to initialize a fresh database
-- ============================================================================

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================================================
-- TASKS TABLE
-- ============================================================================
-- Stores all tasks in the Kanban board with versioning for conflict resolution
-- ============================================================================
CREATE TABLE tasks (
  id VARCHAR(255) PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  column_name VARCHAR(50) NOT NULL CHECK (column_name IN ('todo', 'in-progress', 'done')),
  order_index DOUBLE PRECISION NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for efficient column-based queries and ordering
CREATE INDEX idx_tasks_column_order ON tasks(column_name, order_index);

-- Index for version lookups (used in conflict resolution)
CREATE INDEX idx_tasks_version ON tasks(id, version);

-- Index for updated_at (useful for sorting by recent changes)
CREATE INDEX idx_tasks_updated_at ON tasks(updated_at DESC);

-- ============================================================================
-- USERS TABLE
-- ============================================================================
-- Tracks connected users for presence indicators
-- Note: This is a simple implementation. In production, you might want
-- to add authentication, session management, etc.
-- ============================================================================
CREATE TABLE users (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(7) NOT NULL,
  connected_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for querying active users
CREATE INDEX idx_users_connected_at ON users(connected_at DESC);

-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE tasks IS 'Stores all tasks in the Kanban board with versioning for conflict resolution';
COMMENT ON COLUMN tasks.id IS 'Unique identifier for the task (UUID)';
COMMENT ON COLUMN tasks.title IS 'Task title/name';
COMMENT ON COLUMN tasks.description IS 'Detailed task description';
COMMENT ON COLUMN tasks.column_name IS 'Current column: todo, in-progress, or done';
COMMENT ON COLUMN tasks.order_index IS 'Fractional index for O(1) ordering within column';
COMMENT ON COLUMN tasks.version IS 'Version number for optimistic locking and conflict resolution';
COMMENT ON COLUMN tasks.created_at IS 'Timestamp when task was created';
COMMENT ON COLUMN tasks.updated_at IS 'Timestamp when task was last updated';

COMMENT ON TABLE users IS 'Tracks connected users for presence indicators';
COMMENT ON COLUMN users.id IS 'Unique user identifier (UUID)';
COMMENT ON COLUMN users.name IS 'Display name for the user';
COMMENT ON COLUMN users.color IS 'Hex color code for user avatar/indicator';
COMMENT ON COLUMN users.connected_at IS 'Timestamp when user connected';
COMMENT ON COLUMN users.last_seen IS 'Last activity timestamp';

-- ============================================================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================================================
-- Uncomment below to insert sample tasks for testing

/*
INSERT INTO tasks (id, title, description, column_name, order_index, version) VALUES
  ('sample-1', 'Sample Task 1', 'This is a sample task in To Do', 'todo', 0.5, 1),
  ('sample-2', 'Sample Task 2', 'This is a sample task in Progress', 'in-progress', 0.5, 1),
  ('sample-3', 'Sample Task 3', 'This is a completed task', 'done', 0.5, 1);
*/
