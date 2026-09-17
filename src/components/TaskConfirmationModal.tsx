import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Rocket } from 'lucide-react';
import { AgentModel, TaskPriority } from '../types/index.ts';

export interface TaskConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (details: {
    title: string;
    description: string;
    priority: TaskPriority;
    assignedAgentId: string;
  }) => void;
  initialData: {
    title?: string;
    description?: string;
    priority?: TaskPriority;
    assignedAgentId?: string;
  };
  agents: AgentModel[];
}

export const TaskConfirmationModal: React.FC<TaskConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialData,
  agents,
}) => {
  const [title, setTitle] = useState(initialData.title || '');
  const [description, setDescription] = useState(initialData.description || '');
  const [priority, setPriority] = useState<TaskPriority>(initialData.priority || 'MEDIUM');
  const [assignedAgentId, setAssignedAgentId] = useState<string>(initialData.assignedAgentId || 'boss');

  useEffect(() => {
    if (isOpen) {
      setTitle(initialData.title || '');
      setDescription(initialData.description || '');
      setPriority(initialData.priority || 'MEDIUM');
      setAssignedAgentId(initialData.assignedAgentId || 'boss');
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const assignedAgent = agents.find((a) => a.id === assignedAgentId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onConfirm({
      title: title.trim(),
      description: description.trim(),
      priority,
      assignedAgentId,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-lg bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Rocket className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                Confirm & Launch Task
              </h3>
              <p className="text-[11px] text-slate-400">
                Review and refine details before dispatching to the Task Pipeline
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Agent Banner */}
          {assignedAgent && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-md border"
                style={{
                  backgroundColor: `${assignedAgent.avatar.accentColor}18`,
                  borderColor: assignedAgent.avatar.accentColor,
                }}
              >
                <span>{assignedAgent.roleSymbol}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-slate-100">{assignedAgent.name}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    {assignedAgent.role}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  Planned collaboratively in direct chat
                </p>
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Task Title <span className="text-cyan-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Audit API authentication middleware"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-cyan-500 transition"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Description & Deliverables
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Specify requirements, scope, and technical deliverables..."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-cyan-500 transition resize-none leading-relaxed"
            />
          </div>

          {/* Controls: Priority & Agent */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Assigned Specialist
              </label>
              <select
                value={assignedAgentId}
                onChange={(e) => setAssignedAgentId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.roleSymbol} {a.name} ({a.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-cyan-600/20 transition cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Confirm & Launch Task</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
