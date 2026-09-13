import React, { useState } from 'react';
import { X, Plus, CheckCircle2, Clock, PlayCircle, AlertCircle, ShieldAlert } from 'lucide-react';
import { AgentModel, TaskModel, TaskStatus } from '../types/index.ts';
import { TaskManager } from '../tasks/TaskManager.ts';

interface TaskBoardModalProps {
  tasks: TaskModel[];
  agents: AgentModel[];
  isOpen: boolean;
  onClose: () => void;
  onOpenCreateTask: () => void;
  onSelectAgentById: (agentId: string) => void;
}

export const TaskBoardModal: React.FC<TaskBoardModalProps> = ({
  tasks,
  agents,
  isOpen,
  onClose,
  onOpenCreateTask,
  onSelectAgentById,
}) => {
  const [selectedTask, setSelectedTask] = useState<TaskModel | null>(null);

  if (!isOpen) return null;

  const columns: { title: string; status: TaskStatus[]; icon: React.ReactNode; color: string }[] = [
    { title: 'Queued & Assigned', status: ['QUEUED', 'ASSIGNED'], icon: <Clock className="w-4 h-4 text-slate-400" />, color: 'border-slate-800' },
    { title: 'In Progress', status: ['IN_PROGRESS'], icon: <PlayCircle className="w-4 h-4 text-cyan-400" />, color: 'border-cyan-800' },
    { title: 'Review & Testing', status: ['REVIEW', 'TESTING'], icon: <AlertCircle className="w-4 h-4 text-purple-400" />, color: 'border-purple-800' },
    { title: 'Completed', status: ['COMPLETED'], icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, color: 'border-emerald-800' },
  ];

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'CRITICAL':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'HIGH':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'MEDIUM':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-6xl max-h-[88vh] bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-extrabold text-slate-100 uppercase tracking-wider">
              Agent HQ Task Pipeline
            </h2>
            <span className="text-xs text-slate-400 font-mono">
              ({tasks.length} Total Initiatives)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenCreateTask}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-sm transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Task</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Kanban Board Columns */}
        <div className="flex-1 overflow-x-auto p-4 grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-950/50">
          {columns.map((col) => {
            const colTasks = tasks.filter((t) => col.status.includes(t.status));

            return (
              <div
                key={col.title}
                className="flex flex-col rounded-xl bg-slate-900/40 border border-slate-800/80 p-3 h-full"
              >
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800/60">
                  <div className="flex items-center gap-2">
                    {col.icon}
                    <h3 className="text-xs font-bold text-slate-200">{col.title}</h3>
                  </div>
                  <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-semibold">
                    {colTasks.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                  {colTasks.length === 0 ? (
                    <div className="text-center py-8 text-slate-600 text-xs font-mono">
                      Empty column
                    </div>
                  ) : (
                    colTasks.map((task) => {
                      const assignedAgent = agents.find((a) => a.id === task.assignedAgentId);

                      return (
                        <div
                          key={task.id}
                          onClick={() => setSelectedTask(task)}
                          className="p-3 rounded-lg bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer transition shadow-sm space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase ${getPriorityBadge(
                                task.priority
                              )}`}
                            >
                              {task.priority}
                            </span>

                            {assignedAgent && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectAgentById(assignedAgent.id);
                                  onClose();
                                }}
                                className="flex items-center gap-1 text-[11px] font-bold text-cyan-300 hover:text-cyan-200"
                              >
                                <span>{assignedAgent.roleSymbol}</span>
                                <span>{assignedAgent.name}</span>
                              </button>
                            )}
                          </div>

                          <h4 className="text-xs font-bold text-slate-100 leading-snug">
                            {task.title}
                          </h4>

                          <p className="text-[11px] text-slate-400 line-clamp-2">
                            {task.description}
                          </p>

                          {/* Progress bar */}
                          <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-cyan-400"
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Task Log Detail Modal Overlay */}
        {selectedTask && (
          <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-start justify-between">
            <div className="space-y-1 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wide">
                  Detail Inspection: {selectedTask.title}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                  {selectedTask.status} ({selectedTask.progress}%)
                </span>
              </div>
              <div className="max-h-24 overflow-y-auto font-mono text-[11px] text-slate-300 space-y-1">
                {selectedTask.logs.map((log) => (
                  <div key={log.id} className="text-slate-400">
                    <span className="text-cyan-400">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                    <strong className="text-slate-200">@{log.agentId.toUpperCase()}:</strong> {log.message}
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={() => setSelectedTask(null)}
              className="text-xs text-slate-400 hover:text-slate-200 underline"
            >
              Close Details
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
