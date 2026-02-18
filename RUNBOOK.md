# Runbook: Real-Time Collaborative Task Board

## Table of Contents
1. [System Architecture](#system-architecture)
2. [API Reference](#api-reference)
3. [WebSocket Protocol](#websocket-protocol)
4. [Component Architecture](#component-architecture)
5. [Data Flow](#data-flow)
6. [Deployment Architecture](#deployment-architecture)
7. [Operational Procedures](#operational-procedures)
8. [Troubleshooting](#troubleshooting)
9. [Monitoring & Metrics](#monitoring--metrics)

---

## System Architecture

### High-Level Overview

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   React Client  │◄───────►│  WebSocket      │◄───────►│   PostgreSQL     │
│   (Frontend)    │         │  Server         │         │   Database       │
│   Port: 3000    │         │  Port: 3001     │         │   Port: 5432    │
└─────────────────┘         └─────────────────┘         └─────────────────┘
       │                            │                            │
       │                            │                            │
       └────────────────────────────┴────────────────────────────┘
                    HTTP REST API (Optional)
```

### Technology Stack

**Frontend:**
- React 18 with TypeScript
- @dnd-kit for drag-and-drop
- WebSocket client with offline queue
- Optimistic UI updates

**Backend:**
- Node.js with Express
- TypeScript
- WebSocket (ws library)
- PostgreSQL with pg driver

**Database:**
- PostgreSQL 15+
- Fractional indexing for O(1) ordering
- Version-based optimistic locking

### Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                     │
│  React Components (TaskCard, Column, PresenceIndicator)  │
└──────────────────────┬────────────────────────────────────┘
                       │
┌──────────────────────▼────────────────────────────────────┐
│                    Application Layer                       │
│  WebSocket Client, Hooks (useWebSocket), State Management  │
└──────────────────────┬────────────────────────────────────┘
                       │
┌──────────────────────▼────────────────────────────────────┐
│                    Communication Layer                     │
│  WebSocket Protocol, Message Handlers, Action Queue       │
└──────────────────────┬────────────────────────────────────┘
                       │
┌──────────────────────▼────────────────────────────────────┐
│                    Business Logic Layer                     │
│  TaskService, Conflict Resolution, Fractional Indexing      │
└──────────────────────┬────────────────────────────────────┘
                       │
┌──────────────────────▼────────────────────────────────────┐
│                    Data Access Layer                       │
│  Database Class, SQL Queries, Transactions                │
└──────────────────────┬────────────────────────────────────┘
                       │
┌──────────────────────▼────────────────────────────────────┐
│                    Persistence Layer                       │
│  PostgreSQL Database                                       │
└────────────────────────────────────────────────────────────┘
```

---

## API Reference

### REST API Endpoints

#### Base URL
- **Development**: `http://localhost:3001`
- **Production**: `https://your-backend-domain.com`

#### Endpoints

##### 1. Health Check
```http
GET /api/health
```

**Description**: Check if the server is running and healthy.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Status Codes:**
- `200 OK` - Server is healthy

---

##### 2. Get All Tasks
```http
GET /api/tasks
```

**Description**: Retrieve all tasks from the database (optional endpoint, primarily used via WebSocket).

**Response:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Sample Task",
    "description": "Task description",
    "column": "todo",
    "order": 0.5,
    "version": 1,
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
]
```

**Status Codes:**
- `200 OK` - Success
- `500 Internal Server Error` - Database error

**Query Parameters:**
- None

---

### WebSocket API

#### Connection

**URL:**
- **Development**: `ws://localhost:3001`
- **Production**: `wss://your-backend-domain.com`

**Connection Flow:**
1. Client establishes WebSocket connection
2. Server assigns unique user ID and color
3. Server sends `connected` message with user info
4. Server sends `tasks-loaded` message with all tasks
5. Server broadcasts `user-joined` to other clients
6. Server sends `users-updated` with all connected users

---

## WebSocket Protocol

### Message Format

All WebSocket messages follow this structure:

```typescript
{
  type: string,      // Message type
  payload: any,      // Message payload
  userId?: string,   // Optional: User who triggered the action
  timestamp?: number // Optional: Message timestamp
}
```

---

### Client → Server Messages

#### 1. Create Task
```json
{
  "type": "create-task",
  "payload": {
    "title": "New Task",
    "description": "Task description",
    "column": "todo",
    "order": 0.5  // Optional: fractional index
  }
}
```

**Response:** Server broadcasts `task-created` to all clients

**Error Handling:**
- Invalid column name → `error` message
- Database error → `error` message

---

#### 2. Update Task
```json
{
  "type": "update-task",
  "payload": {
    "id": "task-id",
    "title": "Updated Title",      // Optional
    "description": "Updated Desc",  // Optional
    "version": 1                     // Required: current version
  }
}
```

**Response:**
- Success: Server broadcasts `task-updated` to all clients
- Conflict: Server sends `conflict-detected` to requesting client

**Conflict Detection:**
- If `version` doesn't match database version → conflict detected
- Client receives conflict notification with server's current state

---

#### 3. Move Task
```json
{
  "type": "move-task",
  "payload": {
    "id": "task-id",
    "newColumn": "in-progress",
    "newOrder": 1.5,  // Optional: calculated if not provided
    "version": 1       // Required: current version
  }
}
```

**Response:**
- Success: Server broadcasts `task-moved` to all clients
- Conflict: Server sends `conflict-detected` to requesting client

**Conflict Resolution:**
- If version mismatch → server state wins (deterministic)
- Client notified of conflict

---

#### 4. Reorder Task
```json
{
  "type": "reorder-task",
  "payload": {
    "taskId": "task-id",
    "newOrder": 1.25,
    "version": 1
  }
}
```

**Response:**
- Success: Server broadcasts `task-reordered` to all clients
- Conflict: Server sends `conflict-detected` to requesting client

---

#### 5. Delete Task
```json
{
  "type": "delete-task",
  "payload": {
    "id": "task-id"
  }
}
```

**Response:** Server broadcasts `task-deleted` to all clients

---

#### 6. Resolve Conflict
```json
{
  "type": "resolve-conflict",
  "payload": {
    "taskId": "task-id",
    "clientVersion": 1,
    "clientUpdates": {
      "title": "Client's title",
      "description": "Client's description"
    }
  }
}
```

**Description:** Attempts to merge client changes with server state.

**Response:** Server broadcasts `task-updated` with merged state

---

### Server → Client Messages

#### 1. Connected
```json
{
  "type": "connected",
  "payload": {
    "user": {
      "id": "user-id",
      "name": "User abc12345",
      "color": "#FF6B6B",
      "connectedAt": "2024-01-15T10:00:00.000Z"
    },
    "tasks": []
  }
}
```

**When:** Sent immediately after WebSocket connection established

---

#### 2. Tasks Loaded
```json
{
  "type": "tasks-loaded",
  "payload": {
    "tasks": [
      {
        "id": "task-id",
        "title": "Task Title",
        "description": "Description",
        "column": "todo",
        "order": 0.5,
        "version": 1,
        "createdAt": "2024-01-15T10:00:00.000Z",
        "updatedAt": "2024-01-15T10:00:00.000Z"
      }
    ]
  }
}
```

**When:** Sent after initial connection, contains all existing tasks

---

#### 3. Task Created
```json
{
  "type": "task-created",
  "payload": {
    "task": { /* task object */ },
    "userId": "user-id"
  }
}
```

**When:** Broadcast to all clients when a task is created

---

#### 4. Task Updated
```json
{
  "type": "task-updated",
  "payload": {
    "task": { /* updated task object */ },
    "userId": "user-id"
  }
}
```

**When:** Broadcast to all clients when a task is updated

---

#### 5. Task Moved
```json
{
  "type": "task-moved",
  "payload": {
    "task": { /* task with new column/order */ },
    "userId": "user-id"
  }
}
```

**When:** Broadcast to all clients when a task is moved between columns

---

#### 6. Task Reordered
```json
{
  "type": "task-reordered",
  "payload": {
    "task": { /* task with new order */ },
    "userId": "user-id"
  }
}
```

**When:** Broadcast to all clients when a task is reordered within a column

---

#### 7. Task Deleted
```json
{
  "type": "task-deleted",
  "payload": {
    "taskId": "task-id",
    "userId": "user-id"
  }
}
```

**When:** Broadcast to all clients when a task is deleted

---

#### 8. Conflict Detected
```json
{
  "type": "conflict-detected",
  "payload": {
    "conflict": {
      "resolved": false,
      "task": { /* server's current task state */ },
      "conflictType": "move+edit" | "move+move" | "reorder",
      "message": "Task was modified by another user"
    },
    "originalPayload": { /* client's original request */ }
  }
}
```

**When:** Sent to client when their operation conflicts with server state

---

#### 9. User Joined
```json
{
  "type": "user-joined",
  "payload": {
    "user": {
      "id": "user-id",
      "name": "User abc12345",
      "color": "#FF6B6B",
      "connectedAt": "2024-01-15T10:00:00.000Z"
    }
  }
}
```

**When:** Broadcast to all other clients when a new user connects

---

#### 10. User Left
```json
{
  "type": "user-left",
  "payload": {
    "userId": "user-id"
  }
}
```

**When:** Broadcast to all clients when a user disconnects

---

#### 11. Users Updated
```json
{
  "type": "users-updated",
  "payload": {
    "users": [
      {
        "id": "user-id",
        "name": "User abc12345",
        "color": "#FF6B6B",
        "connectedAt": "2024-01-15T10:00:00.000Z"
      }
    ]
  }
}
```

**When:** Sent to client with list of all connected users

---

#### 12. Error
```json
{
  "type": "error",
  "payload": {
    "message": "Error description"
  }
}
```

**When:** Sent to client when an error occurs processing their request

---

## Component Architecture

### Backend Components

#### 1. Database (`backend/src/db/database.ts`)
**Responsibility:** Database connection and query execution

**Methods:**
- `initialize()` - Create tables from schema
- `getAllTasks()` - Get all tasks ordered by column and order
- `getTaskById(id)` - Get single task by ID
- `createTask(task)` - Create new task (atomic)
- `updateTask(id, updates, version)` - Update task with version check (atomic)
- `deleteTask(id)` - Delete task
- `getMaxOrderInColumn(column)` - Get maximum order index in column
- `close()` - Close database connection pool

**Key Features:**
- Connection pooling (max 20 connections)
- Atomic transactions for all writes
- Optimistic locking via version checking

---

#### 2. TaskService (`backend/src/services/taskService.ts`)
**Responsibility:** Business logic for task operations

**Methods:**
- `getAllTasks()` - Get all tasks
- `getTaskById(id)` - Get task by ID
- `createTask(payload)` - Create task with auto-generated order
- `updateTask(payload)` - Update task with conflict detection
- `moveTask(payload)` - Move task to different column
- `reorderTask(taskId, newOrder, version)` - Reorder task within column
- `deleteTask(id)` - Delete task
- `resolveConflict(taskId, clientVersion, clientUpdates)` - Resolve conflicts

**Conflict Resolution Strategy:**
- **Move + Edit**: Merge non-conflicting fields, server's move wins
- **Move + Move**: Server state wins (deterministic)
- **Reorder**: Server state wins, recalculate based on current DB state

---

#### 3. WebSocketService (`backend/src/services/websocketService.ts`)
**Responsibility:** WebSocket connection management and message routing

**Methods:**
- `handleConnection(ws)` - Handle new WebSocket connection
- `handleMessage(userId, message)` - Route incoming messages
- `sendToClient(userId, message)` - Send message to specific client
- `broadcastToAll(message)` - Broadcast to all clients
- `broadcastToOthers(excludeUserId, message)` - Broadcast to all except one
- `getConnectedUsers()` - Get list of connected users

**Connection Management:**
- Automatic user ID generation
- Random color assignment
- Ping/pong health checks (every 30 seconds)
- Automatic cleanup on disconnect

---

#### 4. FractionalIndex (`backend/src/utils/fractionalIndexing.ts`)
**Responsibility:** O(1) task ordering algorithm

**Methods:**
- `generateBetween(prevIndex, nextIndex)` - Generate new index between two indices
- `getBefore(index)` - Get index before given index
- `getAfter(index)` - Get index after given index
- `needsRebalance(indices)` - Check if rebalancing needed
- `rebalance(indices)` - Rebalance indices when too close

**Algorithm:**
- First item: `0.5`
- Insert at end: `prevMax + 1`
- Insert at start: `firstIndex - 1`
- Insert between: `(prevIndex + nextIndex) / 2`
- Rebalance when indices < 0.0001 apart

---

### Frontend Components

#### 1. WebSocketClient (`frontend/src/services/websocketClient.ts`)
**Responsibility:** WebSocket connection and message handling

**Features:**
- Automatic reconnection with exponential backoff
- Action queue for offline operations
- Message handler registration
- Connection status tracking

**Methods:**
- `connect()` - Establish WebSocket connection
- `send(message)` - Send message (queues if offline)
- `onMessage(handler)` - Register message handler
- `disconnect()` - Close connection
- `getConnectionStatus()` - Get connection status
- `getQueuedActionsCount()` - Get number of queued actions

---

#### 2. useWebSocket Hook (`frontend/src/hooks/useWebSocket.ts`)
**Responsibility:** React hook for WebSocket state management

**Returns:**
- `tasks` - Array of all tasks
- `users` - Array of connected users
- `currentUser` - Current user object
- `isConnected` - Connection status
- `queuedActions` - Number of queued actions
- `sendMessage(type, payload)` - Send WebSocket message
- `setTasks` - Update tasks (for optimistic updates)
- `clearConflict` - Clear conflict state

---

#### 3. App Component (`frontend/src/App.tsx`)
**Responsibility:** Main application component

**Features:**
- Drag-and-drop context setup
- Task creation handlers
- Task edit/delete handlers
- Conflict resolution UI
- Connection status display

---

#### 4. Column Component (`frontend/src/components/Column.tsx`)
**Responsibility:** Kanban column display

**Features:**
- Droppable area for tasks
- Sortable task list
- Task count display
- Empty state handling

---

#### 5. TaskCard Component (`frontend/src/components/TaskCard.tsx`)
**Responsibility:** Individual task card display

**Features:**
- Inline editing
- Drag handle
- Edit/delete buttons
- Visual feedback during drag

---

#### 6. PresenceIndicator Component (`frontend/src/components/PresenceIndicator.tsx`)
**Responsibility:** Display connected users

**Features:**
- User avatars with colors
- Current user highlighting
- User count display

---

## Data Flow

### Task Creation Flow

```
1. User clicks "Add Task"
   ↓
2. Frontend: Optimistic update (adds task to local state)
   ↓
3. Frontend: Send "create-task" via WebSocket
   ↓
4. Backend: WebSocketService receives message
   ↓
5. Backend: TaskService.createTask()
   ↓
6. Backend: Database.createTask() (atomic transaction)
   ↓
7. Backend: Broadcast "task-created" to all clients
   ↓
8. All Clients: Update local state with new task
```

### Task Update Flow (with Conflict)

```
1. User edits task
   ↓
2. Frontend: Optimistic update
   ↓
3. Frontend: Send "update-task" with version
   ↓
4. Backend: TaskService.updateTask()
   ↓
5. Backend: Check version in database
   ↓
6a. Version matches:
    → Update database
    → Broadcast "task-updated"
    → All clients update
   
6b. Version mismatch (CONFLICT):
    → Send "conflict-detected" to requesting client
    → Client shows conflict modal
    → User chooses resolution
    → Send "resolve-conflict" if needed
```

### Offline Action Flow

```
1. User performs action while offline
   ↓
2. Frontend: Action queued in memory
   ↓
3. Frontend: Show "X actions queued" indicator
   ↓
4. Connection restored
   ↓
5. Frontend: Replay all queued actions in order
   ↓
6. Backend: Process each action
   ↓
7. Conflicts handled same as online conflicts
```

---

## Deployment Architecture

### Local Development

```
┌──────────────┐
│   Frontend   │ :3000
│   (React)    │
└──────┬───────┘
       │
       │ WebSocket
       │
┌──────▼───────┐
│   Backend    │ :3001
│  (Node.js)   │
└──────┬───────┘
       │
       │ PostgreSQL
       │
┌──────▼───────┐
│  PostgreSQL  │ :5432
│   Database   │
└──────────────┘
```

### Production (Railway Example)

```
┌─────────────────┐
│  Railway CDN    │
│  (Frontend)     │
└────────┬─────────┘
         │
         │ HTTPS/WSS
         │
┌────────▼─────────┐
│  Railway Server  │
│  (Backend)       │
└────────┬─────────┘
         │
         │ PostgreSQL
         │
┌────────▼─────────┐
│ Railway Postgres │
│  (Managed DB)    │
└──────────────────┘
```

### Docker Compose Architecture

```yaml
services:
  postgres:    # Database container
  backend:     # Node.js backend container
  frontend:    # React frontend container
```

**Network:** All services on same Docker network
**Volumes:** PostgreSQL data persisted

---

## Operational Procedures

### Starting the Application

#### Using Docker Compose (Recommended)
```bash
docker-compose up
```

#### Manual Start
```bash
# Terminal 1: Start PostgreSQL
pg_ctl start

# Terminal 2: Start Backend
cd backend
npm install
npm run dev

# Terminal 3: Start Frontend
cd frontend
npm install
npm start
```

### Stopping the Application

#### Docker Compose
```bash
docker-compose down
```

#### Manual Stop
- Press `Ctrl+C` in each terminal
- Stop PostgreSQL: `pg_ctl stop`

### Database Backup

```bash
# Backup
pg_dump -U postgres taskboard > backup_$(date +%Y%m%d).sql

# Restore
psql -U postgres taskboard < backup_20240115.sql
```

### Database Migration

1. Backup current database
2. Update `schema.sql` with new changes
3. Create migration script
4. Test on development database
5. Apply to production during maintenance window

### Monitoring Health

```bash
# Check backend health
curl http://localhost:3001/api/health

# Check database connection
psql -U postgres -d taskboard -c "SELECT COUNT(*) FROM tasks;"

# Check WebSocket connections
# (Check application logs)
```

### Scaling Considerations

**Horizontal Scaling:**
- Use Redis pub/sub for WebSocket message broadcasting
- Load balancer with sticky sessions for WebSocket
- Database read replicas for read-heavy workloads

**Vertical Scaling:**
- Increase PostgreSQL connection pool size
- Increase Node.js memory limit
- Optimize database queries

---

## Troubleshooting

### Common Issues

#### 1. WebSocket Connection Failed

**Symptoms:**
- Frontend shows "Disconnected" status
- Actions not syncing

**Diagnosis:**
```bash
# Check backend is running
curl http://localhost:3001/api/health

# Check WebSocket endpoint
wscat -c ws://localhost:3001
```

**Solutions:**
- Verify backend is running on port 3001
- Check firewall/network settings
- Verify `REACT_APP_WS_URL` is set correctly
- Check CORS configuration

---

#### 2. Database Connection Error

**Symptoms:**
- Backend logs show connection errors
- Tasks not persisting

**Diagnosis:**
```bash
# Test PostgreSQL connection
psql -U postgres -d taskboard -c "SELECT 1;"

# Check environment variables
echo $DB_HOST $DB_PORT $DB_NAME
```

**Solutions:**
- Verify PostgreSQL is running
- Check database credentials in `.env`
- Ensure database `taskboard` exists
- Check PostgreSQL logs: `tail -f /var/log/postgresql/postgresql.log`

---

#### 3. Tasks Not Appearing

**Symptoms:**
- Tasks created but not visible
- Tasks disappear after refresh

**Diagnosis:**
```sql
-- Check if tasks exist in database
SELECT * FROM tasks;

-- Check WebSocket messages in browser console
```

**Solutions:**
- Check database connection
- Verify WebSocket is connected
- Check browser console for errors
- Verify optimistic updates are working

---

#### 4. Conflict Resolution Not Working

**Symptoms:**
- Conflicts not detected
- Data loss on concurrent edits

**Diagnosis:**
```sql
-- Check task versions
SELECT id, title, version FROM tasks;
```

**Solutions:**
- Verify version field is incrementing
- Check conflict detection logic in TaskService
- Verify WebSocket messages include version
- Test with multiple browser tabs

---

#### 5. Performance Issues

**Symptoms:**
- Slow task loading
- Delayed real-time updates

**Diagnosis:**
```sql
-- Check table sizes
SELECT COUNT(*) FROM tasks;

-- Check indexes
\d tasks
```

**Solutions:**
- Verify indexes exist: `idx_tasks_column_order`
- Check database query performance
- Monitor WebSocket message frequency
- Consider database connection pooling limits

---

### Debugging Commands

#### Backend Logs
```bash
# View backend logs
cd backend
npm run dev  # Shows detailed logs

# Check for errors
grep -i error backend/logs/*.log
```

#### Database Queries
```sql
-- View all tasks
SELECT * FROM tasks ORDER BY column_name, order_index;

-- View task versions
SELECT id, title, version, updated_at FROM tasks;

-- View connected users
SELECT * FROM users ORDER BY connected_at DESC;

-- Check for conflicts (tasks with same ID but different versions)
SELECT id, COUNT(*) as versions 
FROM tasks 
GROUP BY id 
HAVING COUNT(*) > 1;
```

#### Frontend Debugging
```javascript
// In browser console
// Check WebSocket connection
window.wsClient?.getConnectionStatus()

// Check queued actions
window.wsClient?.getQueuedActionsCount()

// View current tasks
// (Use React DevTools)
```

---

## Monitoring & Metrics

### Key Metrics to Monitor

1. **Connection Metrics**
   - Active WebSocket connections
   - Connection duration
   - Reconnection frequency

2. **Performance Metrics**
   - Task creation latency
   - Real-time sync latency (< 200ms target)
   - Database query time

3. **Error Metrics**
   - Conflict detection rate
   - WebSocket errors
   - Database errors

4. **Usage Metrics**
   - Tasks created per hour
   - Concurrent users
   - Actions per user

### Logging

**Backend Logs:**
- User connections/disconnections
- Task operations
- Conflict detections
- Database errors

**Frontend Logs:**
- WebSocket connection status
- Queued actions
- Conflict notifications
- Error messages

### Health Checks

**Endpoint:** `GET /api/health`

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "database": "connected",  // Optional enhancement
  "websocket": "active"      // Optional enhancement
}
```

---

## Security Considerations

### Current Implementation

- **No Authentication**: Users identified by random UUIDs
- **No Authorization**: All users can edit all tasks
- **Input Validation**: Server validates all inputs
- **SQL Injection**: Parameterized queries prevent injection
- **CORS**: Configured for development (adjust for production)

### Production Recommendations

1. **Authentication**: Implement JWT tokens or OAuth
2. **Authorization**: Role-based access control
3. **Rate Limiting**: Prevent abuse
4. **HTTPS/WSS**: Encrypted connections
5. **Input Sanitization**: Additional validation
6. **Audit Logging**: Track all operations

---

## Appendix

### Environment Variables

**Backend:**
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=taskboard
DB_USER=postgres
DB_PASSWORD=postgres
PORT=3001
```

**Frontend:**
```env
REACT_APP_WS_URL=ws://localhost:3001  # Development
REACT_APP_WS_URL=wss://your-backend.com  # Production
```

### Port Reference

- **3000**: Frontend (React)
- **3001**: Backend (Express + WebSocket)
- **5432**: PostgreSQL

### File Structure Reference

```
backend/
├── src/
│   ├── db/
│   │   ├── database.ts      # Database operations
│   │   ├── schema.sql       # Schema definition
│   │   └── init.sql         # Initialization script
│   ├── services/
│   │   ├── taskService.ts   # Business logic
│   │   └── websocketService.ts  # WebSocket handling
│   ├── utils/
│   │   └── fractionalIndexing.ts  # Ordering algorithm
│   ├── types.ts             # TypeScript types
│   └── index.ts             # Server entry point

frontend/
├── src/
│   ├── components/          # React components
│   ├── hooks/              # Custom hooks
│   ├── services/           # WebSocket client
│   └── App.tsx             # Main component
```

---

**Last Updated:** 2024-01-15
**Version:** 1.0.0
