import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { AgentModel, TaskPriority } from '../types/index.ts';
import { TaskManager } from '../tasks/TaskManager.ts';
import { AgentManager } from '../agents/AgentManager.ts';
import { SimulationEngine } from '../simulation/SimulationEngine.ts';

interface CreateTaskModalProps {
  agents: AgentModel[];
  isOpen: boolean;
  onClose: () => void;
  simulationEngine: SimulationEngine;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  agents,
  isOpen,
  onClose,
  simulationEngine,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('HIGH');
  const [assignedAgentId, setAssignedAgentId] = useState<string>('nova');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newTask = TaskManager.createTask({
      title: title.trim(),
      description: description.trim() || 'Autonomous agent initiative execution.',
      priority,
      assignedAgentId: assignedAgentId || undefined,
    });

    if (assignedAgentId) {
      AgentManager.assignTask(assignedAgentId, newTask.id);
      AgentManager.setStatus(assignedAgentId, 'WORKING', `Working on "${title.trim()}"`);
      AgentManager.setSpeech(assignedAgentId, `Starting work on: ${title.trim()}`, 4000);

      // Boss delegates
      simulationEngine.sendAgentMessage(
        'boss',
        assignedAgentId,
        `New assignment: "${title.trim()}" with ${priority} priority.`
      );
    }

    setTitle('');
    setDescription('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Plus className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              Delegate Direct Task
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Task Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Implement rate limiting middleware"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-xs"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Description & Requirements</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Specify requirements, constraints, or expected deliverables..."
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Priority Level</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 focus:outline-none focus:border-cyan-500 text-xs"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Assignee</label>
              <select
                value={assignedAgentId}
                onChange={(e) => setAssignedAgentId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 focus:outline-none focus:border-cyan-500 text-xs"
              >
                <option value="">Unassigned (Queue)</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.roleSymbol} {a.name} ({a.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Submit */}
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold flex items-center gap-1.5 shadow-lg shadow-cyan-600/20 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Dispatch Task</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
