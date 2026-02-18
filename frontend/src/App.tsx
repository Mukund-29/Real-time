import React, { useState, useCallback } from 'react';
import { DndContext, DragEndEvent, DragOverEvent, DragStartEvent, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Task, ConflictResolution } from './types';
import { useWebSocket } from './hooks/useWebSocket';
import { Column } from './components/Column';
import { PresenceIndicator } from './components/PresenceIndicator';
import { FractionalIndex } from './utils/fractionalIndexing';
import './App.css';

const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:3001';

function App() {
  const { tasks, users, currentUser, isConnected, queuedActions, conflict, sendMessage, setTasks, clearConflict } = useWebSocket(WS_URL);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTaskId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Could add visual feedback here
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTaskId(null);

    if (!over) return;

    const taskId = active.id as string;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const overId = over.id as string;
    const isColumn = ['todo', 'in-progress', 'done'].includes(overId);
    const isTask = tasks.some(t => t.id === overId);

    if (isColumn) {
      // Moving to a column
      const targetColumn = overId as 'todo' | 'in-progress' | 'done';
      const columnTasks = tasks.filter(t => t.column === targetColumn && t.id !== taskId);
      const sortedColumnTasks = [...columnTasks].sort((a, b) => a.order - b.order);
      
      let newOrder: number;
      if (sortedColumnTasks.length === 0) {
        newOrder = FractionalIndex.generateBetween(null, null);
      } else {
        newOrder = FractionalIndex.generateBetween(
          sortedColumnTasks[sortedColumnTasks.length - 1].order,
          null
        );
      }

      // Optimistic UI update
      const optimisticTask: Task = {
        ...task,
        column: targetColumn,
        order: newOrder,
        version: task.version + 1,
      };

      setTasks(prev => {
        const filtered = prev.filter(t => t.id !== taskId);
        return [...filtered, optimisticTask];
      });

      // Send to server
      sendMessage('move-task', {
        id: taskId,
        newColumn: targetColumn,
        newOrder,
        version: task.version,
      });
    } else if (isTask) {
      // Reordering within column or moving to different position
      const overTask = tasks.find(t => t.id === overId);
      if (!overTask) return;

      const sameColumn = task.column === overTask.column;
      
      if (sameColumn) {
        // Reordering within same column
        const columnTasks = tasks
          .filter(t => t.column === task.column)
          .sort((a, b) => a.order - b.order);
        
        const oldIndex = columnTasks.findIndex(t => t.id === taskId);
        const newIndex = columnTasks.findIndex(t => t.id === overId);
        
        if (oldIndex === newIndex) return;

        const reordered = arrayMove(columnTasks, oldIndex, newIndex);
        
        // Calculate new orders
        const updatedTasks = reordered.map((t, index) => {
          const prevOrder = index > 0 ? reordered[index - 1].order : null;
          const nextOrder = index < reordered.length - 1 ? reordered[index + 1].order : null;
          const newOrder = FractionalIndex.generateBetween(prevOrder, nextOrder);
          
          if (t.id === taskId) {
            return { ...t, order: newOrder, version: t.version + 1 };
          }
          return t;
        });

        // Optimistic update
        setTasks(prev => {
          const otherTasks = prev.filter(t => t.column !== task.column);
          return [...otherTasks, ...updatedTasks];
        });

        // Send to server
        const movedTask = updatedTasks.find(t => t.id === taskId);
        if (movedTask) {
          sendMessage('reorder-task', {
            taskId: taskId,
            newOrder: movedTask.order,
            version: task.version,
          });
        }
      } else {
        // Moving to different column
        const targetColumn = overTask.column;
        const columnTasks = tasks.filter(t => t.column === targetColumn && t.id !== taskId);
        const sortedColumnTasks = [...columnTasks].sort((a, b) => a.order - b.order);
        const overIndex = sortedColumnTasks.findIndex(t => t.id === overId);
        
        let newOrder: number;
        if (overIndex === -1) {
          newOrder = FractionalIndex.generateBetween(
            sortedColumnTasks.length > 0 ? sortedColumnTasks[sortedColumnTasks.length - 1].order : null,
            null
          );
        } else {
          const prevOrder = overIndex > 0 ? sortedColumnTasks[overIndex - 1].order : null;
          const nextOrder = sortedColumnTasks[overIndex].order;
          newOrder = FractionalIndex.generateBetween(prevOrder, nextOrder);
        }

        // Optimistic update
        const optimisticTask: Task = {
          ...task,
          column: targetColumn,
          order: newOrder,
          version: task.version + 1,
        };

        setTasks(prev => {
          const filtered = prev.filter(t => t.id !== taskId);
          return [...filtered, optimisticTask];
        });

        // Send to server
        sendMessage('move-task', {
          id: taskId,
          newColumn: targetColumn,
          newOrder,
          version: task.version,
        });
      }
    }
  };

  const handleCreateTask = useCallback((column: 'todo' | 'in-progress' | 'done') => {
    const columnTasks = tasks.filter(t => t.column === column);
    const sortedTasks = [...columnTasks].sort((a, b) => a.order - b.order);
    const maxOrder = sortedTasks.length > 0 ? sortedTasks[sortedTasks.length - 1].order : 0;
    const newOrder = FractionalIndex.generateBetween(maxOrder, null);

    // Optimistic update
    const newTask: Task = {
      id: `temp-${Date.now()}`,
      title: 'New Task',
      description: '',
      column,
      order: newOrder,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setTasks(prev => [...prev, newTask]);

    sendMessage('create-task', {
      title: 'New Task',
      description: '',
      column,
      order: newOrder,
    });
  }, [tasks, sendMessage, setTasks]);

  const handleEditTask = useCallback((task: Task) => {
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === task.id ? { ...task, version: t.version + 1 } : t));

    sendMessage('update-task', {
      id: task.id,
      title: task.title,
      description: task.description,
      version: task.version,
    });
  }, [sendMessage, setTasks]);

  const handleDeleteTask = useCallback((taskId: string) => {
    // Optimistic update
    setTasks(prev => prev.filter(t => t.id !== taskId));

    sendMessage('delete-task', { id: taskId });
  }, [sendMessage, setTasks]);

  const columns = [
    { id: 'todo' as const, title: 'To Do' },
    { id: 'in-progress' as const, title: 'In Progress' },
    { id: 'done' as const, title: 'Done' },
  ];

  return (
    <div className="app">
      <header className="app-header">
        <h1>Real-Time Task Board</h1>
        <div className="connection-status">
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
          {queuedActions > 0 && (
            <span className="queue-indicator">
              {queuedActions} action{queuedActions !== 1 ? 's' : ''} queued
            </span>
          )}
        </div>
      </header>

      <div className="app-content">
        {currentUser && (
          <PresenceIndicator users={users} currentUser={currentUser} />
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="board">
            {columns.map((column) => (
              <Column
                key={column.id}
                id={column.id}
                title={column.title}
                tasks={tasks.filter(t => t.column === column.id)}
                onEditTask={handleEditTask}
                onDeleteTask={handleDeleteTask}
              />
            ))}
          </div>
        </DndContext>

        <div className="create-task-buttons">
          {columns.map((column) => (
            <button
              key={column.id}
              onClick={() => handleCreateTask(column.id)}
              className="btn-create-task"
              disabled={!isConnected}
            >
              + Add Task to {column.title}
            </button>
          ))}
        </div>

        {conflict && (
          <div className="conflict-modal">
            <div className="conflict-content">
              <h3>Conflict Detected</h3>
              <p>{conflict.conflict.message || 'This task was modified by another user.'}</p>
              <p className="conflict-type">Type: {conflict.conflict.conflictType}</p>
              <div className="conflict-actions">
                <button
                  onClick={() => {
                    // Resolve by accepting server state
                    clearConflict();
                  }}
                  className="btn-conflict-accept"
                >
                  Accept Server State
                </button>
                <button
                  onClick={() => {
                    // Try to resolve by merging
                    if (conflict.originalPayload) {
                      sendMessage('resolve-conflict', {
                        taskId: conflict.conflict.task.id,
                        clientVersion: conflict.originalPayload.version,
                        clientUpdates: {
                          title: conflict.originalPayload.title,
                          description: conflict.originalPayload.description,
                        },
                      });
                    }
                    clearConflict();
                  }}
                  className="btn-conflict-merge"
                >
                  Try to Merge Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
