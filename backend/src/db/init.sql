-- ============================================================================
-- Database Initialization Script
-- ============================================================================
-- This script can be run directly to set up a fresh database
-- Usage: psql -U postgres -d taskboard -f init.sql
-- ============================================================================

-- Create database (run as postgres superuser)
-- CREATE DATABASE taskboard;

-- Connect to the database
-- \c taskboard;

-- ============================================================================
-- Real-Time Collaborative Task Board - Database Schema
-- ============================================================================

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================================================
-- TASKS TABLE
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

-- Indexes for efficient queries
CREATE INDEX idx_tasks_column_order ON tasks(column_name, order_index);
CREATE INDEX idx_tasks_version ON tasks(id, version);
CREATE INDEX idx_tasks_updated_at ON tasks(updated_at DESC);

-- ============================================================================
-- USERS TABLE
-- ============================================================================
CREATE TABLE users (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(7) NOT NULL,
  connected_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_connected_at ON users(connected_at DESC);

-- ============================================================================
-- GRANT PERMISSIONS (adjust as needed for your setup)
-- ============================================================================
-- GRANT ALL PRIVILEGES ON TABLE tasks TO your_app_user;
-- GRANT ALL PRIVILEGES ON TABLE users TO your_app_user;
-- GRANT USAGE, SELECT ON SEQUENCE tasks_id_seq TO your_app_user;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Verify tables were created
SELECT 
  table_name, 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('tasks', 'users')
ORDER BY table_name, ordinal_position;
