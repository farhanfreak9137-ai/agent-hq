import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Plus, Sparkles, CheckCircle2, ShieldCheck, ListTodo, Users, Zap, Server, Activity } from 'lucide-react';
import { AgentModel, TaskModel, ProviderHealth } from '../types/index.ts';
import { ProviderRegistry } from '../agents/ProviderRegistry.ts';
import { EventBus } from '../events/EventBus.ts';

interface TopBarProps {
  agents: AgentModel[];
  tasks: TaskModel[];
  isPlaying: boolean;
  speed: number;
  activeMissionName: string | null;
  activeMissionStep: number;
  totalMissionSteps: number;
  onTogglePlay: () => void;
  onSetSpeed: (speed: number) => void;
  onReset: () => void;
  onRunDemoMission: () => void;
  onOpenCreateTask: () => void;
  onOpenTaskBoard: () => void;
  onOpenMissionDashboard?: () => void;
  currentUser?: { username: string; role: string } | null;
  persistenceStatus?: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  agents,
  tasks,
  isPlaying,
  speed,
  activeMissionName,
  activeMissionStep,
  totalMissionSteps,
  onTogglePlay,
  onSetSpeed,
  onReset,
  onRunDemoMission,
  onOpenCreateTask,
  onOpenTaskBoard,
  onOpenMissionDashboard,
  currentUser,
  persistenceStatus,
}) => {
  const [providersHealth, setProvidersHealth] = useState<Record<string, ProviderHealth>>({
    mock: { status: 'available', lastChecked: Date.now() },
    gemini: { status: 'unavailable', message: 'Checking backend...', lastChecked: Date.now() },
    antigravity: { status: 'unavailable', message: 'Checking daemon...', lastChecked: Date.now() },
  });

  useEffect(() => {
    const updateHealth = () => {
      const registry = ProviderRegistry.getInstance();
      setProvidersHealth({
        mock: registry.getHealth('mock') || { status: 'available', lastChecked: Date.now() },
        gemini: registry.getHealth('gemini') || { status: 'unavailable', lastChecked: Date.now() },
        antigravity: registry.getHealth('antigravity') || { status: 'unavailable', lastChecked: Date.now() },
      });
    };

    updateHealth();
    ProviderRegistry.getInstance().healthCheckAll().then(updateHealth);

    const unsub = EventBus.on('provider.health_changed', updateHealth);
    return unsub;
  }, []);

  const activeTasksCount = tasks.filter(
    (t) => t.status === 'IN_PROGRESS' || t.status === 'REVIEW' || t.status === 'TESTING'
  ).length;

  const activeAgentsCount = agents.filter(
    (a) => a.status === 'WORKING' || a.status === 'THINKING' || a.status === 'COMMUNICATING'
  ).length;

  return (
    <header className="h-15 bg-slate-950/95 backdrop-blur border-b border-slate-800/80 px-4 flex items-center justify-between z-30 select-none">
      {/* Brand Identity */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-cyan-400/30">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-extrabold tracking-wider text-slate-100 uppercase">
              Agent <span className="text-cyan-400">HQ</span>
            </h1>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              ONLINE
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium tracking-tight">
            Where AI agents work.
          </p>
        </div>
      </div>

      {/* Center Mission / Operational Status HUD */}
      {activeMissionName ? (
        <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-cyan-950/40 border border-cyan-500/40 animate-pulse">
          <Sparkles className="w-4 h-4 text-cyan-400 animate-spin" style={{ animationDuration: '3s' }} />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider">
                Active Mission Step {activeMissionStep}/{totalMissionSteps}
              </span>
              <div className="w-24 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-cyan-400 transition-all duration-300"
                  style={{ width: `${(activeMissionStep / totalMissionSteps) * 100}%` }}
                />
              </div>
            </div>
            <span className="text-[10px] text-slate-300 truncate max-w-xs">{activeMissionName}</span>
          </div>
        </div>
      ) : (
        <div className="hidden lg:flex items-center gap-5 text-xs text-slate-300 font-mono">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              Agents: <strong className="text-white font-bold">{activeAgentsCount}</strong>/{agents.length} active
            </span>
          </div>
          <div className="w-1 h-1 rounded-full bg-slate-700" />
          <div className="flex items-center gap-1.5">
            <ListTodo className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              Tasks: <strong className="text-white font-bold">{activeTasksCount}</strong> active / {tasks.length} total
            </span>
          </div>
          <div className="w-1 h-1 rounded-full bg-slate-700" />
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
            <span>Zero-Trust Architecture</span>
          </div>
        </div>
      )}

      {/* Right Actions & Controls */}
      <div className="flex items-center gap-2.5">
        {/* Provider Status Pill (Phase 2) */}
        <div className="hidden xl:flex items-center gap-2 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-mono select-none">
          <Server className="w-3 h-3 text-slate-400" />
          <span className="text-slate-500 font-bold uppercase">Providers:</span>

          <div className="flex items-center gap-1" title={providersHealth.mock?.message || 'Mock Engine'}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-slate-200">Mock</span>
          </div>

          <span className="text-slate-700">|</span>

          <div className="flex items-center gap-1" title={providersHealth.gemini?.message || 'Gemini Provider'}>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                providersHealth.gemini?.status === 'available' ? 'bg-emerald-400' : 'bg-slate-600'
              }`}
            />
            <span
              className={
                providersHealth.gemini?.status === 'available' ? 'text-slate-200' : 'text-slate-500'
              }
            >
              Gemini
            </span>
          </div>

          <span className="text-slate-700">|</span>

          <div className="flex items-center gap-1" title={providersHealth.antigravity?.message || 'Antigravity Provider'}>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                providersHealth.antigravity?.status === 'available' ? 'bg-emerald-400' : 'bg-slate-600'
              }`}
            />
            <span
              className={
                providersHealth.antigravity?.status === 'available' ? 'text-slate-200' : 'text-slate-500'
              }
            >
              Antigravity
            </span>
          </div>
        </div>

        {/* Persistence & Auth Badges (Phase 3A) */}
        <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 bg-slate-900/90 border border-slate-800 rounded-lg text-[10px] font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-slate-300">{persistenceStatus || 'SQLite Synced'}</span>
          {currentUser && (
            <>
              <span className="text-slate-700">|</span>
              <span className="text-cyan-400 font-semibold">👤 {currentUser.username} ({currentUser.role})</span>
            </>
          )}
        </div>

        {/* Simulation Speed & Playback */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 gap-1">
          <button
            onClick={onTogglePlay}
            title={isPlaying ? 'Pause simulation' : 'Play simulation'}
            className={`p-1.5 rounded transition ${
              isPlaying
                ? 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30'
                : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          <div className="flex items-center border-l border-slate-800 pl-1 gap-0.5">
            {[1, 2, 4].map((s) => (
              <button
                key={s}
                onClick={() => onSetSpeed(s)}
                className={`px-1.5 py-0.5 text-[11px] font-mono rounded transition ${
                  speed === s
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          <button
            onClick={onReset}
            title="Reset Simulation State"
            className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Mission Dashboard / Ops button */}
        {onOpenMissionDashboard && (
          <button
            onClick={onOpenMissionDashboard}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-700/60 text-xs font-medium transition"
          >
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Operations</span>
          </button>
        )}

        {/* Task Board button */}
        <button
          onClick={onOpenTaskBoard}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium transition"
        >
          <ListTodo className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden sm:inline">Tasks</span>
        </button>

        {/* New Task button */}
        <button
          onClick={onOpenCreateTask}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-medium transition"
        >
          <Plus className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">New Task</span>
        </button>

        {/* Primary Demo Mission Button */}
        <button
          onClick={onRunDemoMission}
          disabled={Boolean(activeMissionName)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md transition ${
            activeMissionName
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              : 'bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-cyan-500/20 border border-cyan-400/40 cursor-pointer active:scale-95'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
          <span>Run Demo Mission</span>
        </button>
      </div>
    </header>
  );
};
