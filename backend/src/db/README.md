# Database Schema Documentation

This directory contains the database schema and initialization scripts for the Real-Time Collaborative Task Board.

## Files

- `schema.sql` - Main schema file used by the application (auto-executed on startup)
- `init.sql` - Standalone initialization script for manual database setup

## Database Structure

### Tables

#### `tasks`
Stores all tasks in the Kanban board.

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(255) | Primary key, UUID |
| `title` | TEXT | Task title |
| `description` | TEXT | Task description |
| `column_name` | VARCHAR(50) | Current column: 'todo', 'in-progress', or 'done' |
| `order_index` | DOUBLE PRECISION | Fractional index for O(1) ordering |
| `version` | INTEGER | Version number for optimistic locking |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |

**Indexes:**
- `idx_tasks_column_order` - For efficient column-based queries
- `idx_tasks_version` - For version lookups in conflict resolution
- `idx_tasks_updated_at` - For sorting by recent changes

#### `users`
Tracks connected users for presence indicators.

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(255) | Primary key, UUID |
| `name` | VARCHAR(255) | Display name |
| `color` | VARCHAR(7) | Hex color code for UI |
| `connected_at` | TIMESTAMP | Connection timestamp |
| `last_seen` | TIMESTAMP | Last activity timestamp |

**Indexes:**
- `idx_users_connected_at` - For querying active users

## Setup Instructions

### Automatic Setup (Recommended)

The application automatically creates tables on startup via `database.ts`. Just ensure PostgreSQL is running and the connection credentials are correct.

### Manual Setup

1. **Create Database:**
   ```sql
   CREATE DATABASE taskboard;
   ```

2. **Run Initialization Script:**
   ```bash
   psql -U postgres -d taskboard -f backend/src/db/init.sql
   ```

   Or using Docker:
   ```bash
   docker exec -i taskboard-postgres psql -U postgres -d taskboard < backend/src/db/init.sql
   ```

3. **Verify Tables:**
   ```sql
   \dt  -- List tables
   \d tasks  -- Describe tasks table
   \d users  -- Describe users table
   ```

## Environment Variables

Set these in your `.env` file or environment:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=taskboard
DB_USER=postgres
DB_PASSWORD=postgres
```

## Schema Design Decisions

### Fractional Indexing
- Uses `DOUBLE PRECISION` for `order_index` to enable O(1) insertion/reordering
- No need to reindex entire column when moving tasks

### Version-Based Locking
- `version` field enables optimistic locking
- Prevents data loss in concurrent edit scenarios
- Increments on every update

### Column Constraint
- CHECK constraint ensures only valid column names: 'todo', 'in-progress', 'done'
- Prevents invalid data at database level

## Migration Notes

If you need to modify the schema:

1. Create a migration script
2. Update `schema.sql` for new installations
3. Test on development database first
4. Backup production database before applying

## Troubleshooting

### Tables Not Created
- Check PostgreSQL connection credentials
- Verify database exists
- Check application logs for errors

### Permission Errors
- Ensure database user has CREATE TABLE permissions
- Check GRANT statements in `init.sql`

### Connection Issues
- Verify PostgreSQL is running
- Check firewall/network settings
- Confirm port 5432 is accessible
