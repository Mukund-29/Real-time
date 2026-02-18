import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { Database } from './db/database';
import { TaskService } from './services/taskService';
import { WebSocketService } from './services/websocketService';
import cors from 'cors';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

const db = new Database();
const taskService = new TaskService(db);
const wsService = new WebSocketService(taskService);

// Initialize database
db.initialize().catch(console.error);

// REST API endpoints (optional, for direct HTTP access)
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await taskService.getAllTasks();
    res.json(tasks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  const userId = wsService.handleConnection(ws);
  console.log(`User ${userId} connected`);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await db.close();
  server.close();
  process.exit(0);
});
