import React, { useState } from 'react';
import { X, Plus, Users, Sparkles, Check, Crown, ArrowRight } from 'lucide-react';
import { AgentModel, TaskPriority } from '../types/index.ts';
import { TaskManager } from '../tasks/TaskManager.ts';
import { AgentManager } from '../agents/AgentManager.ts';
import { SimulationEngine } from '../simulation/SimulationEngine.ts';
import { BossOrchestrator } from '../orchestration/BossOrchestrator.ts';
import { EmailManager } from '../email/EmailManager.ts';

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
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>(['boss']);

  if (!isOpen) return null;

  const toggleAgent = (agentId: string) => {
    if (agentId === 'boss') {
      setSelectedAgentIds(['boss']);
      return;
    }

    // Remove boss if selecting specific agents
    let next = selectedAgentIds.filter((id) => id !== 'boss');
    if (next.includes(agentId)) {
      next = next.filter((id) => id !== agentId);
    } else {
      next.push(agentId);
    }

    if (next.length === 0) {
      next = ['boss'];
    }
    setSelectedAgentIds(next);
  };

  const setPreset = (agentIds: string[]) => {
    setSelectedAgentIds(agentIds);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Case 1: BOSS Auto-Orchestration
    if (selectedAgentIds.length === 1 && selectedAgentIds[0] === 'boss') {
      BossOrchestrator.getInstance().launchCustomMission(title.trim(), description.trim() || undefined);
      setTitle('');
      setDescription('');
      onClose();
      return;
    }

    // Case 2: Multi-Agent Team Collaboration
    if (selectedAgentIds.length > 1) {
      // Remove boss from the list if present to avoid redundancy
      const team = selectedAgentIds.filter((id) => id !== 'boss');
      BossOrchestrator.getInstance().launchTeamMission(
        title.trim(),
        description.trim() || undefined,
        team.length > 0 ? team : selectedAgentIds
      );
      setTitle('');
      setDescription('');
      onClose();
      return;
    }

    // Case 3: Single Specialist Execution
    const singleAgentId = selectedAgentIds[0];
    const newTask = TaskManager.createTask({
      title: title.trim(),
      description: description.trim() || 'Autonomous agent initiative execution.',
      priority,
      assignedAgentId: singleAgentId || undefined,
    });

    if (singleAgentId) {
      TaskManager.updateStatus(newTask.id, 'IN_PROGRESS');
      AgentManager.assignTask(singleAgentId, newTask.id);
      AgentManager.setStatus(singleAgentId, 'WORKING', `Working on "${title.trim()}"`);
      AgentManager.setSpeech(singleAgentId, `Starting work on: ${title.trim()}`, 4000);

      simulationEngine.sendAgentMessage(
        'boss',
        singleAgentId,
        `Direct assignment: "${title.trim()}" with ${priority} priority.`
      );

      AgentManager.executeTask(singleAgentId, newTask)
        .then((result) => {
          if (result.success) {
            TaskManager.updateStatus(newTask.id, 'COMPLETED', result);
            EmailManager.sendTaskReport(
              singleAgentId,
              title.trim(),
              result.summary || 'Direct task completed successfully.',
              result.output,
              result.toolsUsed
            );
          } else {
            TaskManager.updateStatus(newTask.id, 'BLOCKED', { error: result.error });
          }
        })
        .catch((err) => {
          console.warn('[CreateTaskModal] Direct task execution error:', err);
          TaskManager.updateStatus(newTask.id, 'BLOCKED', { error: String(err) });
        });
    }

    setTitle('');
    setDescription('');
    onClose();
  };

  const isBossMode = selectedAgentIds.length === 1 && selectedAgentIds[0] === 'boss';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                Delegate Initiative & Assign Agents
              </h3>
              <p className="text-[11px] text-slate-400">
                Choose one specialist or select multiple agents to form a collaborative team.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Task Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Research competitor benchmarks and create Word document"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-xs"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Description & Requirements</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Specify output format (e.g. .docx, .xlsx, .md), constraints, or chapters..."
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-xs"
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="w-1/3">
              <label className="block text-slate-300 font-semibold mb-1">Priority</label>
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

            {/* Quick Presets */}
            <div className="w-2/3">
              <label className="block text-slate-400 font-semibold mb-1 text-[11px]">
                Quick Team Presets:
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setPreset(['boss'])}
                  className={`px-2 py-1 rounded text-[10px] font-semibold border transition cursor-pointer ${
                    isBossMode
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  👑 Auto (BOSS)
                </button>
                <button
                  type="button"
                  onClick={() => setPreset(['atlas', 'quill', 'echo'])}
                  className="px-2 py-1 rounded text-[10px] font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition cursor-pointer"
                >
                  📖 Docs & Case Study
                </button>
                <button
                  type="button"
                  onClick={() => setPreset(['quill', 'echo'])}
                  className="px-2 py-1 rounded text-[10px] font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition cursor-pointer"
                >
                  ✍️ Novel & Story
                </button>
                <button
                  type="button"
                  onClick={() => setPreset(['atlas', 'strategist'])}
                  className="px-2 py-1 rounded text-[10px] font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition cursor-pointer"
                >
                  📊 Excel & Data
                </button>
                <button
                  type="button"
                  onClick={() => setPreset(['nova', 'vector', 'echo'])}
                  className="px-2 py-1 rounded text-[10px] font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition cursor-pointer"
                >
                  💻 Dev & Code
                </button>
              </div>
            </div>
          </div>

          {/* Multi-Agent Selector Grid */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span>Select Agents to Involve:</span>
                <span className="text-[11px] text-cyan-400 font-mono">
                  ({selectedAgentIds.length} {selectedAgentIds.length === 1 ? 'Agent' : 'Agents'} Selected)
                </span>
              </label>
              <button
                type="button"
                onClick={() => setSelectedAgentIds(agents.map((a) => a.id))}
                className="text-[10px] text-slate-400 hover:text-cyan-400 hover:underline cursor-pointer"
              >
                Select All
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1 bg-slate-900/40 rounded-xl border border-slate-800/80">
              {agents.map((a) => {
                const isSelected = selectedAgentIds.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleAgent(a.id)}
                    className={`flex items-start gap-2 p-2 rounded-xl text-left border transition cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-500/60 shadow-sm shadow-cyan-500/10'
                        : 'bg-slate-900/80 border-slate-800/80 hover:bg-slate-800/60 text-slate-400'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 mt-0.5 rounded flex items-center justify-center shrink-0 border text-[10px] ${
                        isSelected
                          ? 'bg-cyan-500 border-cyan-400 text-slate-950 font-bold'
                          : 'border-slate-700 bg-slate-800'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-[11px] text-slate-200 truncate flex items-center gap-1">
                        <span>{a.roleSymbol}</span>
                        <span>{a.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {a.role}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dynamic Pipeline Preview */}
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 text-[11px] text-slate-300">
            {isBossMode ? (
              <div className="flex items-center gap-2 text-amber-300 font-semibold">
                <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                <span>BOSS Mode: Intelligent automatic DAG planning & role delegation.</span>
              </div>
            ) : selectedAgentIds.length === 1 ? (
              <div className="flex items-center gap-2 text-cyan-300">
                <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>
                  Direct Specialist Task: Assigned purely to{' '}
                  <strong>{agents.find((a) => a.id === selectedAgentIds[0])?.name || selectedAgentIds[0]}</strong>.
                </span>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-cyan-300 text-[11px]">
                  <Users className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Custom Collaborative Pipeline:</span>
                </div>
                <div className="flex items-center gap-1 flex-wrap text-slate-200 font-mono text-[10px]">
                  {selectedAgentIds.map((id, idx) => {
                    const ag = agents.find((a) => a.id === id);
                    return (
                      <React.Fragment key={id}>
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 font-semibold">
                          {ag?.roleSymbol} {ag?.name || id}
                        </span>
                        {idx < selectedAgentIds.length - 1 && (
                          <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="pt-2 flex justify-end gap-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 font-medium transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold flex items-center gap-1.5 shadow-lg shadow-cyan-600/20 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>
                {selectedAgentIds.length > 1
                  ? `Dispatch Team (${selectedAgentIds.length})`
                  : 'Dispatch Task'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
