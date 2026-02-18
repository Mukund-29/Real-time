import { useEffect, useState, useCallback, useRef } from 'react';
import { WebSocketClient } from '../services/websocketClient';
import { Task, User, WebSocketMessage, ConflictResolution } from '../types';

export function useWebSocket(url: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [queuedActions, setQueuedActions] = useState(0);
  const [conflict, setConflict] = useState<{ conflict: ConflictResolution; originalPayload: any } | null>(null);
  const wsClientRef = useRef<WebSocketClient | null>(null);

  useEffect(() => {
    const client = new WebSocketClient(url);
    wsClientRef.current = client;

    const unsubscribe = client.onMessage((message: WebSocketMessage) => {
      switch (message.type) {
        case 'connected':
          setCurrentUser(message.payload.user);
          setIsConnected(true);
          break;

        case 'tasks-loaded':
          setTasks(message.payload.tasks);
          break;

        case 'task-created':
        case 'task-updated':
        case 'task-moved':
        case 'task-reordered':
          setTasks(prev => {
            const existing = prev.find(t => t.id === message.payload.task.id);
            if (existing) {
              return prev.map(t => t.id === message.payload.task.id ? message.payload.task : t);
            }
            return [...prev, message.payload.task];
          });
          break;

        case 'task-deleted':
          setTasks(prev => prev.filter(t => t.id !== message.payload.taskId));
          break;

        case 'user-joined':
        case 'user-left':
        case 'users-updated':
          setUsers(message.payload.users || []);
          break;

        case 'conflict-detected':
          setConflict({
            conflict: message.payload.conflict,
            originalPayload: message.payload.originalPayload,
          });
          // Revert optimistic update by reloading tasks
          if (message.payload.conflict.task) {
            setTasks(prev => {
              const filtered = prev.filter(t => t.id !== message.payload.conflict.task.id);
              return [...filtered, message.payload.conflict.task];
            });
          }
          break;

        default:
          break;
      }
    });

    client.connect()
      .then(() => {
        setIsConnected(true);
      })
      .catch(console.error);

    // Update queued actions count periodically
    const interval = setInterval(() => {
      if (client) {
        setQueuedActions(client.getQueuedActionsCount());
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      unsubscribe();
      client.disconnect();
    };
  }, [url]);

  const sendMessage = useCallback((type: string, payload: any) => {
    if (wsClientRef.current) {
      wsClientRef.current.send({ type, payload });
      // Update queued actions count
      setQueuedActions(wsClientRef.current.getQueuedActionsCount());
    }
  }, []);

  const clearConflict = useCallback(() => {
    setConflict(null);
  }, []);

  return {
    tasks,
    users,
    currentUser,
    isConnected,
    queuedActions,
    conflict,
    sendMessage,
    setTasks, // For optimistic updates
    clearConflict,
  };
}
