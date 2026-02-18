import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Task } from '../types';
import { TaskCard } from './TaskCard';
import './Column.css';

interface ColumnProps {
  id: 'todo' | 'in-progress' | 'done';
  title: string;
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
}

export const Column: React.FC<ColumnProps> = ({
  id,
  title,
  tasks,
  onEditTask,
  onDeleteTask,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  const sortedTasks = [...tasks].sort((a, b) => a.order - b.order);

  return (
    <div className={`column ${isOver ? 'drag-over' : ''}`}>
      <div className="column-header">
        <h2 className="column-title">{title}</h2>
        <span className="column-count">{tasks.length}</span>
      </div>
      <div ref={setNodeRef} className="column-content">
        <SortableContext items={sortedTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {sortedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="column-empty">Drop tasks here</div>
        )}
      </div>
    </div>
  );
};
