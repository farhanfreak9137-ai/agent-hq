import React, { useState, useEffect } from 'react';
import {
  X,
  Cpu,
  CheckCircle2,
  Trash2,
  RotateCcw,
  Sparkles,
  Zap,
  HardDrive,
  Database,
  Users,
  Key,
  Shield,
} from 'lucide-react';
import { AgentModel, ProviderHealth } from '../types/index.ts';
import { AgentManager } from '../agents/AgentManager.ts';
import { TaskManager } from '../tasks/TaskManager.ts';
import { ProviderRegistry } from '../agents/ProviderRegistry.ts';
import { EventBus } from '../events/EventBus.ts';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetSimulation?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onResetSimulation,
}) => {
  const [agents, setAgents] = useState<AgentModel[]>(() => AgentManager.getAll());
  const [globalProvider, setGlobalProvider] = useState<string>('gemini');
  const [globalApplySuccess, setGlobalApplySuccess] = useState<string | null>(null);
  const [clearTasksSuccess, setClearTasksSuccess] = useState<boolean>(false);
  const [providersHealth, setProvidersHealth] = useState<Record<string, ProviderHealth>>({
    mock: { status: 'available', lastChecked: Date.now() },
    gemini: { status: 'unavailable', message: 'Checking backend...', lastChecked: Date.now() },
    antigravity: { status: 'unavailable', message: 'Checking daemon...', lastChecked: Date.now() },
  });

  useEffect(() => {
    if (!isOpen) return;

    const syncAgents = () => {
      setAgents([...AgentManager.getAll()]);
    };

    const updateHealth = () => {
      const registry = ProviderRegistry.getInstance();
      setProvidersHealth({
        mock: registry.getHealth('mock') || { status: 'available', lastChecked: Date.now() },
        gemini: registry.getHealth('gemini') || { status: 'unavailable', lastChecked: Date.now() },
        antigravity: registry.getHealth('antigravity') || { status: 'unavailable', lastChecked: Date.now() },
      });
    };

    syncAgents();
    updateHealth();

    const unsubAgent = EventBus.on('agent.state_changed', syncAgents);
    const unsubHealth = EventBus.on('provider.health_changed', updateHealth);

    return () => {
      unsubAgent();
      unsubHealth();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApplyGlobalProvider = () => {
    AgentManager.setAllAgentProviders(globalProvider);
    setAgents([...AgentManager.getAll()]);
    const label =
      globalProvider === 'gemini'
        ? 'Gemini API'
        : globalProvider === 'antigravity'
        ? 'Google Antigravity CLI'
        : 'Local Simulation Engine';
    setGlobalApplySuccess(`All 7 agents updated to [${label}]`);
    setTimeout(() => setGlobalApplySuccess(null), 3000);
  };

  const handleSetIndividualProvider = (agentId: string, providerId: string) => {
    AgentManager.setAgentProvider(agentId, providerId);
    setAgents([...AgentManager.getAll()]);
  };

  const handleClearTaskBoard = async () => {
    if (window.confirm('Clear all task initiatives and test nodes from the pipeline?')) {
      await TaskManager.clearAllTasks();
      setClearTasksSuccess(true);
      setTimeout(() => setClearTasksSuccess(false), 2500);
    }
  };

  const handleResetSimulation = () => {
    if (onResetSimulation) {
      onResetSimulation();
    } else {
      AgentManager.reset();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150 select-none">
      <div className="flex flex-col w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                Agent HQ Settings & AI Orchestration
              </h2>
              <p className="text-xs text-slate-400">
                Configure global and individual agent AI provider engines, model routing, and maintenance.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs bg-slate-950/30">
          {/* Section 1: Global AI Provider Engine Switch */}
          <div className="p-5 rounded-xl bg-slate-900/90 border border-cyan-500/30 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Global AI Provider Engine
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                Batch Config
              </span>
            </div>

            <p className="text-slate-300 text-[11px] leading-relaxed">
              Switch the active AI engine for <span className="text-cyan-400 font-semibold">all agents at once</span>. You can still customize individual agent engines below.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Gemini Option */}
              <label
                className={`flex flex-col p-3.5 rounded-xl border cursor-pointer transition-all ${
                  globalProvider === 'gemini'
                    ? 'bg-cyan-950/40 border-cyan-400 shadow-md shadow-cyan-900/20'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-100 flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="globalProvider"
                      value="gemini"
                      checked={globalProvider === 'gemini'}
                      onChange={() => setGlobalProvider('gemini')}
                      className="text-cyan-500 focus:ring-0"
                    />
                    Gemini API
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                    Multi-Key
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Real Google Gemini API (<code className="text-cyan-300">gemini-3.6-flash</code>) with automatic round-robin key rotation.
                </p>
              </label>

              {/* Antigravity Option */}
              <label
                className={`flex flex-col p-3.5 rounded-xl border cursor-pointer transition-all ${
                  globalProvider === 'antigravity'
                    ? 'bg-indigo-950/40 border-indigo-400 shadow-md shadow-indigo-900/20'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-100 flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="globalProvider"
                      value="antigravity"
                      checked={globalProvider === 'antigravity'}
                      onChange={() => setGlobalProvider('antigravity')}
                      className="text-indigo-500 focus:ring-0"
                    />
                    Antigravity (agy)
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono font-bold">
                    CLI Active
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Official local Google Antigravity CLI daemon (<code className="text-indigo-300">v1.2.5</code>) reasoning engine.
                </p>
              </label>

              {/* Local Simulation Option */}
              <label
                className={`flex flex-col p-3.5 rounded-xl border cursor-pointer transition-all ${
                  globalProvider === 'mock'
                    ? 'bg-slate-800/80 border-slate-400 shadow-md'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-100 flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="globalProvider"
                      value="mock"
                      checked={globalProvider === 'mock'}
                      onChange={() => setGlobalProvider('mock')}
                      className="text-slate-400 focus:ring-0"
                    />
                    Local Engine
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono font-bold">
                    Simulation
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Fast deterministic local simulation (Zero API calls, instant testing without consuming tokens).
                </p>
              </label>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleApplyGlobalProvider}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md shadow-cyan-600/30 transition cursor-pointer active:scale-95"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Apply to All 7 Agents</span>
              </button>

              {globalApplySuccess && (
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{globalApplySuccess}</span>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Granular Per-Agent Controls */}
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Individual Agent Providers
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">
                Override engine per specialist
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{agent.roleSymbol || '🤖'}</span>
                    <div>
                      <h4 className="font-bold text-slate-100 text-xs">
                        {agent.name}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {agent.role}
                      </span>
                    </div>
                  </div>

                  <select
                    value={agent.providerId || 'mock'}
                    onChange={(e) => handleSetIndividualProvider(agent.id, e.target.value)}
                    className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-cyan-300 font-mono text-[11px] font-semibold focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="gemini">Gemini API</option>
                    <option value="antigravity">Antigravity (agy)</option>
                    <option value="mock">Local Engine</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Live Health & Provider Diagnostics */}
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Active Provider Diagnostics
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Gemini Backend</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="text-xs font-bold text-slate-200">
                  {providersHealth.gemini?.message || '3 Keys in Rotation Pool'}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  Model: gemini-3.6-flash
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Antigravity CLI</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="text-xs font-bold text-slate-200">
                  {providersHealth.antigravity?.message || 'Official Google Antigravity CLI v1.2.5'}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  Daemon: gemini-3.8-flash-low
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Persistence</span>
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                </div>
                <div className="text-xs font-bold text-slate-200">
                  SQLite WAL Mode Active
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  File: data/agenthq.db
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Maintenance & Data Purging */}
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-rose-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Pipeline & Board Maintenance
              </h3>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-rose-950/20 border border-rose-900/40">
              <div>
                <h4 className="font-bold text-slate-200 text-xs">Clear Task Pipeline</h4>
                <p className="text-[11px] text-slate-400">
                  Wipes all test DAG nodes, completed tasks, and queued test artifacts from the task board and database.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClearTaskBoard}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-900/50 hover:bg-rose-800/70 border border-rose-700/60 text-rose-200 hover:text-white font-semibold text-xs shadow transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>{clearTasksSuccess ? 'Pipeline Cleared!' : 'Clear All Tasks'}</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-950/40 border border-slate-800">
              <div>
                <h4 className="font-bold text-slate-200 text-xs">Reset Agent Workstations</h4>
                <p className="text-[11px] text-slate-400">
                  Returns all agents to their default desk positions and resets in-memory animation paths.
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetSimulation}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white font-semibold text-xs shadow transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                <span>Reset Simulation</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3.5 border-t border-slate-800 bg-slate-950/80">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
