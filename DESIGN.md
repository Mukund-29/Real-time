# Design Document: Real-Time Collaborative Task Board

## Overview

This document describes the architecture, conflict resolution strategy, ordering approach, and trade-offs made in the implementation of the real-time collaborative task board.

## Architecture

### System Components

1. **Backend (Node.js/Express/TypeScript)**
   - REST API for health checks
   - WebSocket server for real-time communication
   - PostgreSQL database for persistence
   - Task service layer for business logic
   - WebSocket service for connection management

2. **Frontend (React/TypeScript)**
   - React components with drag-and-drop
   - WebSocket client with offline queue
   - Optimistic UI updates
   - Conflict resolution UI

3. **Database (PostgreSQL)**
   - Tasks table with versioning
   - Users table for presence tracking
   - Atomic transactions for consistency

### Communication Flow

```
Client → WebSocket → WebSocketService → TaskService → Database
                ↓
         Broadcast to all clients
```

## Conflict Resolution Strategy

### Version-Based Optimistic Locking

All tasks have a `version` field that increments on each update. When a client attempts to modify a task, it must include the current version. The server compares the client's version with the database version:

- **Version Match**: Update proceeds normally
- **Version Mismatch**: Conflict detected, resolution strategy applied

### Conflict Types and Resolution

#### 1. Concurrent Move + Edit

**Scenario**: User A moves Task X to "Done" while User B edits Task X's title.

**Resolution**:
- Both operations are independent (move affects `column`/`order`, edit affects `title`/`description`)
- Server merges changes: preserves the move operation and applies the edit
- Both users see the updated task in the new column with the new title

**Implementation**:
```typescript
// Server detects version mismatch
// Merges non-conflicting fields
const merged = {
  ...serverTask,  // Latest from server (has the move)
  ...clientUpdates,  // Client's edit
  column: serverTask.column,  // Server's move wins
  order: serverTask.order
};
```

#### 2. Concurrent Move + Move

**Scenario**: User A moves Task X to "In Progress" while User B moves Task X to "Done".

**Resolution**:
- **Deterministic Resolution**: Server state wins (last-write-wins based on database transaction order)
- The "losing" user receives a conflict notification
- User can choose to:
  - Accept server state (task stays where server moved it)
  - Attempt merge (if edit was also made)

**Implementation**:
```typescript
// Server processes moves in transaction order
// First transaction to commit wins
// Second transaction detects version mismatch
// Returns conflict with server's current state
```

#### 3. Concurrent Reorder

**Scenario**: User A reorders tasks in a column while User B adds a new task to the same column.

**Resolution**:
- Server processes operations in transaction order
- New task gets inserted with fractional index
- Reorder operation recalculates indices based on current state
- Final order is consistent across all clients

**Implementation**:
- Fractional indexing allows O(1) insertion without full reindexing
- Each operation calculates new indices based on current database state
- Conflicts are rare due to independent index calculations

### Conflict Resolution UI

When a conflict is detected:

1. **Conflict Modal** appears with:
   - Conflict type description
   - Current server state
   - Options to resolve

2. **Resolution Options**:
   - **Accept Server State**: Discard local changes, use server state
   - **Try to Merge**: Attempt to merge non-conflicting changes

3. **Automatic Recovery**:
   - Optimistic updates are reverted
   - Server state is applied
   - User can retry their operation if needed

## Ordering Approach: Fractional Indexing

### Why Fractional Indexing?

Traditional array-based ordering requires O(n) operations to reindex when inserting or moving items. Fractional indexing provides O(1) amortized complexity.

### How It Works

1. **Initial State**: First task gets index `0.5`
2. **Insert at End**: New index = `previousMax + 1`
3. **Insert at Start**: New index = `firstIndex - 1`
4. **Insert Between**: New index = `(prevIndex + nextIndex) / 2`

### Example

```
Initial: [0.5]
Add at end: [0.5, 1.5]
Add at start: [-0.5, 0.5, 1.5]
Insert between: [-0.5, 0.5, 1.0, 1.5]
```

### Rebalancing

When indices get too close (< 0.0001 apart), rebalancing is triggered:

```typescript
// Before: [1.0, 1.0001, 1.0002]
// After: [0, 1, 2]
```

Rebalancing is O(n) but amortized over many operations, maintaining O(1) average.

### Benefits

- **O(1) Insertion**: No need to update other tasks
- **No Gaps**: Indices are continuous
- **Deterministic**: Same operations produce same order
- **Concurrent-Safe**: Multiple inserts can happen simultaneously

## Offline Support

### Action Queue

When WebSocket disconnects:

1. **Actions are Queued**: All user actions (create, update, move, delete) are stored in memory
2. **Visual Indicator**: UI shows "X actions queued"
3. **Reconnection**: On reconnect, queued actions are replayed in order
4. **Conflict Handling**: Replayed actions use the same conflict resolution as online actions

### Implementation

```typescript
class WebSocketClient {
  private actionQueue: QueuedAction[] = [];
  
  send(message) {
    if (connected) {
      ws.send(message);
    } else {
      this.queueAction(message);
    }
  }
  
  replayQueuedActions() {
    // Replay all queued actions on reconnect
  }
}
```

### Trade-offs

- **In-Memory Queue**: Actions are lost on page refresh
  - **Alternative**: IndexedDB for persistence (not implemented for simplicity)
- **No Conflict Preview**: Conflicts are only detected on replay
  - **Alternative**: Predictive conflict detection (complex, not implemented)

## Database Design

### Tasks Table

```sql
CREATE TABLE tasks (
  id VARCHAR(255) PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  column_name VARCHAR(50) NOT NULL,
  order_index DOUBLE PRECISION NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Key Design Decisions

1. **Version Field**: Enables optimistic locking
2. **Order Index**: Double precision for fractional indexing
3. **Atomic Transactions**: All updates wrapped in transactions
4. **Index on (column, order)**: Efficient queries for column tasks

### Atomic Writes

All database operations use transactions:

```typescript
await client.query('BEGIN');
// ... operations ...
await client.query('COMMIT');
// On error: await client.query('ROLLBACK');
```

This ensures:
- No partial updates on server crash
- Consistent state across operations
- Version increments are atomic

## WebSocket Architecture

### Message Types

**Client → Server**:
- `create-task`: Create new task
- `update-task`: Update task (title/description)
- `move-task`: Move task to different column
- `reorder-task`: Reorder task within column
- `delete-task`: Delete task
- `resolve-conflict`: Resolve detected conflict

**Server → Client**:
- `connected`: Connection established with user info
- `tasks-loaded`: Initial task list
- `task-created`: New task created
- `task-updated`: Task updated
- `task-moved`: Task moved
- `task-reordered`: Task reordered
- `task-deleted`: Task deleted
- `conflict-detected`: Conflict detected
- `user-joined`: User connected
- `user-left`: User disconnected
- `users-updated`: Updated user list

### Connection Management

- **Automatic Reconnection**: Exponential backoff (1s, 2s, 3s, ...)
- **Ping/Pong**: Health checks every 30 seconds
- **User Tracking**: Each connection gets unique user ID and color
- **Broadcasting**: Changes broadcast to all connected clients

## Optimistic UI

### Strategy

1. **Immediate Update**: UI updates instantly on user action
2. **Server Sync**: Action sent to server
3. **Reconciliation**: Server response updates UI with authoritative state
4. **Conflict Handling**: On conflict, optimistic update is reverted

### Benefits

- **Perceived Performance**: UI feels instant
- **Offline Support**: Works even when disconnected
- **User Experience**: No waiting for server round-trip

### Trade-offs

- **Temporary Inconsistency**: UI may show incorrect state briefly
- **Conflict Reversion**: User may see their change reverted
- **Complexity**: Need to handle rollback logic

## Testing Strategy

### Unit Tests

- **Fractional Indexing**: Test index generation, rebalancing
- **Task Service**: Test conflict detection, version checking
- **Database**: Test atomic operations, version increments

### Integration Tests

- **Conflict Scenarios**: Test all three conflict types
- **Concurrent Operations**: Multiple clients acting simultaneously
- **Offline Replay**: Test action queue and replay

### Test Coverage

- Core business logic: > 80%
- Conflict resolution: All scenarios covered
- Fractional indexing: All edge cases covered

## Trade-offs and Limitations

### Chosen Approaches

1. **Fractional Indexing over Array Reindexing**
   - **Pro**: O(1) performance, scales better
   - **Con**: More complex, requires rebalancing

2. **Version-Based Locking over CRDTs**
   - **Pro**: Simpler implementation, deterministic
   - **Con**: Requires conflict resolution UI

3. **In-Memory Queue over IndexedDB**
   - **Pro**: Simpler, no persistence complexity
   - **Con**: Actions lost on refresh

4. **Server-Wins for Move Conflicts**
   - **Pro**: Deterministic, simple
   - **Con**: User may lose their move

### Known Limitations

1. **No Authentication**: Users identified by random IDs
2. **No Task History**: No audit trail of changes
3. **No Real-Time Cursors**: Only presence indicators
4. **Limited Offline Persistence**: Queue lost on refresh
5. **No Task Assignments**: All users can edit all tasks

### Future Improvements

1. **IndexedDB Queue**: Persist actions across refreshes
2. **CRDTs**: More sophisticated conflict resolution
3. **Operational Transforms**: For text editing conflicts
4. **User Authentication**: Proper user management
5. **Task History**: Audit log of all changes
6. **Real-Time Cursors**: Show where users are editing

## Performance Considerations

### Backend

- **Database Indexes**: Index on (column, order) for fast queries
- **Connection Pooling**: Reuse database connections
- **WebSocket Broadcasting**: Efficient message distribution

### Frontend

- **Optimistic Updates**: Reduce perceived latency
- **Debouncing**: Could debounce rapid edits (not implemented)
- **Virtual Scrolling**: For large task lists (not implemented)

### Scalability

- **Current**: Single server instance
- **Future**: Horizontal scaling with Redis pub/sub for WebSocket broadcasting
- **Database**: Read replicas for read-heavy workloads

## Security Considerations

### Current Implementation

- **No Authentication**: Anyone can connect
- **No Authorization**: All users can edit all tasks
- **Input Validation**: Server validates all inputs
- **SQL Injection**: Parameterized queries prevent injection

### Production Considerations

- **Authentication**: JWT tokens, OAuth
- **Authorization**: Role-based access control
- **Rate Limiting**: Prevent abuse
- **HTTPS/WSS**: Encrypted connections
- **CORS**: Proper CORS configuration

## Conclusion

This implementation provides a solid foundation for real-time collaboration with:

- ✅ Efficient O(1) ordering
- ✅ Robust conflict resolution
- ✅ Offline support
- ✅ Optimistic UI
- ✅ Clean architecture

The system handles the core requirements while maintaining simplicity and testability. Future enhancements can build upon this foundation to add more sophisticated features.
