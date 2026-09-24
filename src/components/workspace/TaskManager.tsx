import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Plus, CheckSquare, Square, Trash2, ListChecks, AlertCircle } from 'lucide-react';

export const TaskManager: React.FC = () => {
  const { matchTasks, addTask, toggleTask, deleteTask } = useApp();
  const [taskInput, setTaskInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const completedCount = matchTasks.filter((t) => t.isCompleted).length;
  const totalCount = matchTasks.length;

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskInput.trim()) {
      setError('Please enter a valid task description');
      return;
    }

    if (!addTask(taskInput)) {
      setError('Tasks can only be added during an active match');
      return;
    }
    setError(null);
    setTaskInput('');
  };

  return (
    <Card variant="default" padding="md" className="space-y-4 border-[#36425E]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#2A3348] pb-3">
        <div className="flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-[#6C7CFF]" aria-hidden="true" />
          <h2 className="text-base font-bold text-[#F1F5F9] font-mono">Today's Focus Goals</h2>
        </div>

        <Badge variant={completedCount === totalCount && totalCount > 0 ? 'teal' : 'indigo'}>
          {completedCount} / {totalCount} Done
        </Badge>
      </div>

      {/* Add Task Form */}
      <form onSubmit={handleAddTask} className="space-y-2" noValidate>
        <div className="flex gap-2">
          <label htmlFor="new-task" className="sr-only">
            New study goal
          </label>
          <input
            id="new-task"
            type="text"
            value={taskInput}
            maxLength={200}
            aria-invalid={!!error}
            aria-describedby={error ? 'new-task-error' : undefined}
            onChange={(e) => {
              setTaskInput(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Add a new study goal (e.g., Revise Ch 4 notes)..."
            className={`flex-1 min-w-0 px-3.5 py-2 bg-[#222B42] border ${
              error ? 'border-[#FF7A7A]' : 'border-[#2A3348] focus:border-[#6C7CFF]'
            } rounded-xl text-xs text-[#F1F5F9] placeholder-[#475569] focus:outline-none focus:ring-1 focus:ring-[#6C7CFF] transition-all font-sans`}
          />
          <Button
            type="submit"
            variant="teal"
            size="sm"
            disabled={!taskInput.trim()}
            icon={<Plus className="w-4 h-4" />}
          >
            Add Goal
          </Button>
        </div>

        {error && (
          <div id="new-task-error" role="alert" className="flex items-center gap-1.5 text-xs text-[#FF7A7A]">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
      </form>

      {/* Task Item List */}
      {matchTasks.length === 0 ? (
        <div className="text-center py-6 text-xs text-[#94A3B8] border border-dashed border-[#2A3348] rounded-xl space-y-1">
          <p>No study tasks added yet.</p>
          <p className="text-[11px] text-[#475569]">Add your coursework targets to build match points!</p>
        </div>
      ) : (
        <ul className="space-y-2 max-h-64 overflow-y-auto pr-1" aria-label="Match tasks">
          {matchTasks.map((task) => (
            <li
              key={task.id}
              className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                task.isCompleted
                  ? 'bg-[#1A2133]/60 border-[#2A3348] opacity-75'
                  : 'bg-[#222B42] border-[#2A3348] hover:border-[#36425E]'
              }`}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={task.isCompleted}
                onClick={() => toggleTask(task.id)}
                className="flex items-center gap-3 text-left flex-1 min-w-0 rounded-lg"
                title={task.isCompleted ? 'Mark as not done' : 'Mark as done'}
              >
                {task.isCompleted ? (
                  <CheckSquare className="w-4 h-4 text-[#3DD9B3] shrink-0" aria-hidden="true" />
                ) : (
                  <Square className="w-4 h-4 text-[#94A3B8] shrink-0" aria-hidden="true" />
                )}
                <span
                  className={`text-xs text-[#F1F5F9] truncate ${
                    task.isCompleted ? 'line-through text-[#94A3B8]' : ''
                  }`}
                >
                  {task.description}
                </span>
              </button>

              <button
                type="button"
                onClick={() => deleteTask(task.id)}
                className="p-1 text-[#94A3B8] hover:text-[#FF7A7A] rounded-lg transition-colors ml-2 shrink-0"
                title="Delete task"
                aria-label={`Delete task: ${task.description}`}
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};
