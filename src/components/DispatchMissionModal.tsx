import React, { useState } from 'react';
import { X, Sparkles, Crown, ArrowRight, Shield, Cpu, Search, Palette, CheckCircle2 } from 'lucide-react';

interface DispatchMissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDispatch: (goal: string, description?: string) => void;
  isDispatching?: boolean;
}

export const DispatchMissionModal: React.FC<DispatchMissionModalProps> = ({
  isOpen,
  onClose,
  onDispatch,
  isDispatching = false,
}) => {
  const [goal, setGoal] = useState('');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim() || isDispatching) return;

    onDispatch(goal.trim(), description.trim() || undefined);
    setGoal('');
    setDescription('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-slate-950 border border-slate-800/90 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-amber-500/20 border border-amber-400/30">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                Dispatch Mission to BOSS
              </h3>
              <p className="text-[11px] text-slate-400">
                Autonomous multi-agent goal decomposition & orchestration.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5 flex items-center justify-between">
              <span>Mission Objective / Goal</span>
              <span className="text-[10px] text-slate-500 font-normal">Real-World Task</span>
            </label>
            <input
              type="text"
              required
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Audit authentication endpoints and patch session memory leaks"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 text-xs transition"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              Scope, Constraints & Requirements (Optional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add specific context, targeted repositories, compliance rules, or deliverable formats..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 text-xs transition"
            />
          </div>

          {/* Autonomous Role Assignment Preview */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2">
            <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              How BOSS Plans Your Mission:
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                <span><strong>NOVA</strong>: Code & APIs</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-blue-400" />
                <span><strong>ATLAS</strong>: Research & Docs</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-red-400" />
                <span><strong>SENTINEL</strong>: Security Audit</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-amber-400" />
                <span><strong>PIXEL</strong>: UI/UX Design</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-800/60">
              BOSS evaluates your objective, selects only the necessary agents, builds the task graph (DAG), and synthesizes final deliverables into artifacts.
            </p>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!goal.trim() || isDispatching}
              className={`px-4 py-2 rounded-lg text-white font-semibold flex items-center gap-2 shadow-lg transition ${
                !goal.trim() || isDispatching
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-gradient-to-r from-amber-500 via-indigo-600 to-cyan-500 hover:from-amber-400 hover:to-cyan-400 shadow-amber-500/20 cursor-pointer active:scale-95'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-200" />
              <span>{isDispatching ? 'Orchestrating...' : 'Dispatch Mission'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
