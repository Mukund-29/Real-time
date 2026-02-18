# Real-Time Collaborative Task Board

A Kanban-style task board with real-time collaboration, conflict resolution, and offline support. Built with React, Node.js, TypeScript, PostgreSQL, and WebSockets.

## Features

- ✅ Three-column Kanban board (To Do, In Progress, Done)
- ✅ Real-time synchronization via WebSockets (< 200ms latency)
- ✅ Drag-and-drop task movement and reordering
- ✅ Conflict resolution for concurrent edits
- ✅ Offline support with action queue and replay
- ✅ Multi-user presence indicators
- ✅ Optimistic UI updates
- ✅ O(1) task ordering using fractional indexing

## Tech Stack

### Backend
- Node.js with Express
- TypeScript
- WebSocket (ws)
- PostgreSQL
- Fractional indexing for O(1) ordering

### Frontend
- React 18
- TypeScript
- @dnd-kit for drag-and-drop
- WebSocket client with offline queue

## Prerequisites

- Node.js 18+
- Docker and Docker Compose (recommended)
- PostgreSQL 15+ (if not using Docker)

## Database Setup

The database schema is automatically created on first run. For manual setup, see [backend/src/db/README.md](./backend/src/db/README.md).

### Quick Database Setup

**Using Docker (Automatic):**
```bash
docker-compose up  # Database is created automatically
```

**Manual Setup:**
```bash
# Create database
createdb taskboard

# Run initialization script
psql -U postgres -d taskboard -f backend/src/db/init.sql
```

### Database Schema

- **tasks** - Stores all Kanban tasks with versioning for conflict resolution
- **users** - Tracks connected users for presence indicators

See `backend/src/db/schema.sql` for the complete schema definition.

## Quick Start

### Using Docker Compose (Recommended)

1. Clone the repository:
```bash
git clone <repository-url>
cd Realtime
```

2. Start all services:
```bash
docker-compose up
```

This will start:
- PostgreSQL on port 5432
- Backend server on port 3001
- Frontend on port 3000

3. Open your browser to `http://localhost:3000`

### Manual Setup

#### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables (create `.env` file):
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=taskboard
DB_USER=postgres
DB_PASSWORD=postgres
PORT=3001
```

4. Start PostgreSQL (if not already running)

5. Build and run:
```bash
npm run build
npm start
```

For development with hot reload:
```bash
npm run dev
```

#### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm start
```

The frontend will be available at `http://localhost:3000`

## Project Structure

```
.
├── backend/
│   ├── src/
│   │   ├── db/              # Database schema and operations
│   │   ├── services/        # Business logic (TaskService, WebSocketService)
│   │   ├── utils/           # Utilities (fractional indexing)
│   │   ├── types.ts         # TypeScript types
│   │   └── index.ts         # Express server entry point
│   ├── package.json
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── services/        # WebSocket client
│   │   ├── utils/           # Utilities
│   │   └── App.tsx          # Main app component
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── README.md
└── DESIGN.md
```

## Testing

### Backend Tests

```bash
cd backend
npm test
```

### Running Tests in Watch Mode

```bash
cd backend
npm run test:watch
```

## Deployment

### GitHub Repository

**Yes, you can push your code to GitHub!** However, GitHub Pages alone cannot host this full-stack application because:
- GitHub Pages only supports static sites (HTML/CSS/JS)
- This app requires a Node.js backend and WebSocket support
- PostgreSQL database needs separate hosting

**What you CAN do with GitHub:**
- ✅ Store your code in a GitHub repository
- ✅ Use GitHub Actions for CI/CD (see `.github/workflows/ci.yml`)
- ✅ Deploy frontend to GitHub Pages (with separate backend hosting)
- ✅ Use GitHub to deploy to Railway/Render/Vercel

**Recommended approach:**
1. Push code to GitHub
2. Deploy backend to Railway or Render
3. Deploy frontend to Vercel or Railway
4. Connect both to your GitHub repo for automatic deployments

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

### Railway (Recommended - Full Stack)

1. Create a new Railway project
2. Add PostgreSQL service
3. Deploy backend:
   - Connect GitHub repository
   - Set environment variables
   - Deploy from `backend/` directory
4. Deploy frontend:
   - Create new service
   - Deploy from `frontend/` directory
   - Set `REACT_APP_WS_URL` to backend WebSocket URL

### Render

1. Create PostgreSQL database
2. Deploy backend as a Web Service
3. Deploy frontend as a Static Site
4. Configure environment variables

### Environment Variables

#### Backend
- `DB_HOST`: PostgreSQL host
- `DB_PORT`: PostgreSQL port (default: 5432)
- `DB_NAME`: Database name
- `DB_USER`: Database user
- `DB_PASSWORD`: Database password
- `PORT`: Server port (default: 3001)

#### Frontend
- `REACT_APP_WS_URL`: WebSocket URL (e.g., `wss://your-backend.railway.app`)

## Usage

1. **Create Tasks**: Click the "+ Add Task" button in any column
2. **Edit Tasks**: Click the edit icon on a task card
3. **Move Tasks**: Drag and drop tasks between columns
4. **Reorder Tasks**: Drag tasks within the same column
5. **Delete Tasks**: Click the delete icon on a task card

### Multi-User Collaboration

- Open multiple browser tabs/windows
- Each user gets a unique color and name
- Changes sync in real-time (< 200ms)
- Presence indicators show all online users

### Offline Mode

- Actions are queued when offline
- Queue indicator shows number of pending actions
- Actions replay automatically on reconnect
- Conflicts are resolved using the same strategy as online conflicts

## Conflict Resolution

The system handles three types of conflicts:

1. **Concurrent Move + Edit**: Both changes are preserved
2. **Concurrent Move + Move**: Server state wins, user is notified
3. **Concurrent Reorder**: Server state wins, user is notified

See [DESIGN.md](./DESIGN.md) for detailed conflict resolution strategy.

## Performance

- Task ordering: O(1) amortized using fractional indexing
- Real-time sync: < 200ms latency on localhost
- Optimistic UI: Instant feedback before server confirmation
- Database writes: Atomic transactions prevent partial updates

## Troubleshooting

### WebSocket Connection Issues

- Check that backend is running on port 3001
- Verify `REACT_APP_WS_URL` is set correctly
- Check browser console for connection errors

### Database Connection Issues

- Ensure PostgreSQL is running
- Verify database credentials in `.env`
- Check that database `taskboard` exists

### Port Conflicts

- Backend: Change `PORT` in `.env` or docker-compose.yml
- Frontend: Change port in `package.json` scripts
- PostgreSQL: Change port mapping in docker-compose.yml

## License

This project is part of a take-home assignment.

## Support

For issues or questions, please refer to the DESIGN.md file for architectural details.
