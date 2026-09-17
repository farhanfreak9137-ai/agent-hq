import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Plus,
  Sparkles,
  ListTodo,
  Zap,
  Activity,
  Mail,
  ShieldCheck,
  Compass,
  Briefcase,
  User,
  Settings,
} from 'lucide-react';
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
  onRunDemoMission?: () => void;
  onOpenDispatchMission?: () => void;
  onOpenCreateTask: () => void;
  onOpenTaskBoard: () => void;
  onOpenMissionDashboard?: () => void;
  onOpenInbox?: () => void;
  onOpenOpportunityHQ?: () => void;
  onOpenFarhanProfile?: () => void;
  onOpenSettings?: () => void;
  opportunityCount?: number;
  unreadEmailCount?: number;
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
  onOpenCreateTask,
  onOpenTaskBoard,
  onOpenMissionDashboard,
  onOpenInbox,
  onOpenOpportunityHQ,
  onOpenFarhanProfile,
  onOpenSettings,
  opportunityCount = 0,
  unreadEmailCount = 0,
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
    const interval = setInterval(updateHealth, 4000);
    const unsub = EventBus.on('provider.health_changed', updateHealth);

    return () => {
      clearInterval(interval);
      unsub();
    };
  }, []);

  const activeTasksCount = tasks.filter(
    (t) => t.status === 'IN_PROGRESS' || t.status === 'REVIEW' || t.status === 'TESTING'
  ).length;

  const activeAgentsCount = agents.filter(
    (a) => a.status === 'WORKING' || a.status === 'THINKING' || a.status === 'COMMUNICATING'
  ).length;

  return (
    <header className="h-14 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 flex items-center justify-between z-30 select-none">
      {/* Brand Identity */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-cyan-400/30 text-white">
          <Zap className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-extrabold tracking-wider text-slate-100 uppercase">
              Agent <span className="text-cyan-400">HQ</span>
            </h1>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              ONLINE
            </span>
          </div>
        </div>
      </div>

      {/* Center Mission / Operational Status Capsule */}
      {activeMissionName ? (
        <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-cyan-950/40 border border-cyan-500/30">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin" style={{ animationDuration: '4s' }} />
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-cyan-300 text-[11px]">
              Step {activeMissionStep}/{totalMissionSteps}:
            </span>
            <span className="text-slate-200 truncate max-w-xs">{activeMissionName}</span>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex items-center gap-2.5 px-3 py-1 rounded-full bg-slate-900/60 border border-slate-800/60 text-xs text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="font-medium text-slate-200">
            {activeAgentsCount > 0 ? `${activeAgentsCount} of ${agents.length} active` : 'All agents ready'}
          </span>
          {activeTasksCount > 0 && (
            <>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400">{activeTasksCount} {activeTasksCount === 1 ? 'task' : 'tasks'} running</span>
            </>
          )}
        </div>
      )}

      {/* Right Actions & Controls */}
      <div className="flex items-center gap-2">
        {/* Simulation Speed & Playback Controls */}
        <div className="flex items-center bg-slate-900/90 border border-slate-800 rounded-lg p-1 gap-1">
          <button
            onClick={onTogglePlay}
            title={isPlaying ? 'Pause simulation' : 'Play simulation'}
            className={`p-1 rounded transition ${
              isPlaying
                ? 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30'
                : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
            }`}
          >
            {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 text-emerald-400" />}
          </button>

          <div className="flex items-center border-l border-slate-800 pl-1 gap-0.5">
            {[1, 2, 4].map((s) => (
              <button
                key={s}
                onClick={() => onSetSpeed(s)}
                className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition ${
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
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>

        {/* Executive Inbox Button with Unread Badge */}
        {onOpenInbox && (
          <button
            onClick={onOpenInbox}
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-medium transition cursor-pointer"
            title="Executive Secure Mail (Direct Agent Reports)"
          >
            <Mail className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Inbox</span>
            {unreadEmailCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-cyan-500 text-slate-950 font-extrabold text-[10px] animate-pulse">
                {unreadEmailCount}
              </span>
            )}
          </button>
        )}

        {/* Tasks Button */}
        <button
          onClick={onOpenTaskBoard}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-medium transition cursor-pointer"
        >
          <ListTodo className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden sm:inline">Tasks</span>
          {tasks.length > 0 && (
            <span className="text-[10px] font-mono text-slate-400">({tasks.length})</span>
          )}
        </button>

        {/* Operations Button */}
        {onOpenMissionDashboard && (
          <button
            onClick={onOpenMissionDashboard}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-700/60 text-xs font-medium transition cursor-pointer"
          >
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            <span>Operations</span>
          </button>
        )}

        {/* Farhan Authoritative Profile Button */}
        {onOpenFarhanProfile && (
          <button
            onClick={onOpenFarhanProfile}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-medium transition cursor-pointer"
            title="Farhan Authoritative Professional Profile"
          >
            <User className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Farhan Profile</span>
          </button>
        )}

        {/* Settings Button */}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-medium transition cursor-pointer"
            title="Agent HQ Settings & Global AI Provider Engine"
          >
            <Settings className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        )}

        {/* Opportunity HQ Button with Badge */}
        {onOpenOpportunityHQ && (
          <button
            onClick={onOpenOpportunityHQ}
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-700/60 text-xs font-medium transition cursor-pointer"
            title="Opportunity HQ (Discovered, Verified & Matched Opportunities)"
          >
            <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Opportunities</span>
            {opportunityCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono text-[10px] font-bold">
                {opportunityCount}
              </span>
            )}
          </button>
        )}

        {/* Primary Create Task Button */}
        <button
          onClick={onOpenCreateTask}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 shadow-md shadow-cyan-600/20 border border-cyan-400/40 cursor-pointer active:scale-95 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Task</span>
        </button>
      </div>
    </header>
  );
};
