import React, { useState, useEffect } from 'react';
import { X, Focus, Home, Coffee, Send, MessageSquare, CheckCircle, Activity, Sparkles, User, Cpu, Wrench, Database } from 'lucide-react';
import { AgentModel, TaskModel } from '../types/index.ts';
import { MessageBus } from '../communication/MessageBus.ts';
import { TaskManager } from '../tasks/TaskManager.ts';
import { AgentManager } from '../agents/AgentManager.ts';
import { EventBus } from '../events/EventBus.ts';
import { SimulationEngine } from '../simulation/SimulationEngine.ts';
import { Camera } from '../world/Camera.ts';

import { ArtifactManager } from '../artifacts/ArtifactManager.ts';
import { TelemetryService } from '../telemetry/TelemetryService.ts';

interface AgentInspectorProps {
  agent: AgentModel | null;
  onClose: () => void;
  camera: Camera;
  simulationEngine: SimulationEngine;
}

export const AgentInspector: React.FC<AgentInspectorProps> = ({
  agent,
  onClose,
  camera,
  simulationEngine,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'messages' | 'advanced'>('details');
  const [quickMsg, setQuickMsg] = useState('');
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsub = EventBus.on('*', () => setTick((t) => t + 1));
    return unsub;
  }, []);

  if (!agent) return null;

  const runtime = AgentManager.getRuntime(agent.id);
  const runtimeMemories = runtime ? runtime.memory.recent(10) : [];
  const runtimeStatus = runtime ? runtime.status : agent.status;
  const capabilities = agent.capabilities || (runtime ? runtime.capabilities : []);
  const tools = agent.tools || [];

  const agentArtifacts = ArtifactManager.getInstance().getByAgentId(agent.id);
  const agentTelemetry = TelemetryService.getInstance().getAgentTelemetry(agent.id);

  const currentTask = agent.currentTaskId ? TaskManager.getById(agent.currentTaskId) : null;
  const recentMessages = MessageBus.getMessagesForAgent(agent.id).slice(0, 10);
  const agentTasks = TaskManager.getByAgentId(agent.id);

  const handleFocus = () => {
    camera.focusOnPosition(agent.currentPosition, 1.4);
  };

  const handleReturnDesk = () => {
    simulationEngine.moveAgentTo(agent.id, agent.deskPosition, undefined, agent.facing);
  };

  const handleSendToLounge = () => {
    simulationEngine.moveAgentTo(agent.id, { x: 760, y: 505 });
  };

  const handleSendQuickMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickMsg.trim()) return;

    // Send to BOSS or NOVA
    const targetId = agent.id === 'boss' ? 'nova' : 'boss';
    simulationEngine.sendAgentMessage(agent.id, targetId, quickMsg.trim());
    setQuickMsg('');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'WORKING':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'TOOL_EXECUTION':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/30 animate-pulse';
      case 'WAITING_APPROVAL':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30 animate-pulse';
      case 'THINKING':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
      case 'COMMUNICATING':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'COMPLETED':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'ERROR':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <aside className="fixed top-18 right-4 bottom-4 w-84 md:w-96 bg-slate-950/95 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl z-20 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar Icon Box */}
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-lg border"
            style={{
              backgroundColor: `${agent.avatar.accentColor}18`,
              borderColor: agent.avatar.accentColor,
            }}
          >
            <span>{agent.roleSymbol}</span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-slate-100">{agent.name}</h2>
              <span
                className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border uppercase ${getStatusBadge(
                  agent.status
                )}`}
              >
                {agent.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">{agent.role}</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Simplified Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-900/40 text-xs font-medium text-slate-400">
        <button
          onClick={() => setActiveTab('details')}
          className={`flex-1 py-2.5 text-center border-b-2 transition ${
            activeTab === 'details'
              ? 'border-cyan-400 text-cyan-300 font-semibold'
              : 'border-transparent hover:text-slate-200'
          }`}
        >
          Overview & Work
        </button>
        <button
          onClick={() => setActiveTab('messages')}
          className={`flex-1 py-2.5 text-center border-b-2 transition ${
            activeTab === 'messages'
              ? 'border-cyan-400 text-cyan-300 font-semibold'
              : 'border-transparent hover:text-slate-200'
          }`}
        >
          Messages {recentMessages.length > 0 && `(${recentMessages.length})`}
        </button>
        <button
          onClick={() => setActiveTab('advanced')}
          className={`flex-1 py-2.5 text-center border-b-2 transition ${
            activeTab === 'advanced'
              ? 'border-cyan-400 text-cyan-300 font-semibold'
              : 'border-transparent hover:text-slate-200'
          }`}
        >
          Advanced
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'details' && (
          <>
            {/* Quick World Actions */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={handleFocus}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-cyan-400 text-[11px] font-medium transition"
              >
                <Focus className="w-4 h-4 mb-1 text-cyan-400" />
                Focus Camera
              </button>
              <button
                onClick={handleReturnDesk}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-emerald-400 text-[11px] font-medium transition"
              >
                <Home className="w-4 h-4 mb-1 text-emerald-400" />
                Return to Desk
              </button>
              <button
                onClick={handleSendToLounge}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-purple-400 text-[11px] font-medium transition"
              >
                <Coffee className="w-4 h-4 mb-1 text-purple-400" />
                Break Lounge
              </button>
            </div>

            {/* Current Active Task */}
            {currentTask ? (
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" />
                    Active Task
                  </span>
                  <span className="font-mono text-cyan-400 font-bold">{currentTask.progress}%</span>
                </div>
                <h4 className="text-xs font-bold text-slate-100">{currentTask.title}</h4>
                <p className="text-[11px] text-slate-400 line-clamp-2">{currentTask.description}</p>
                {/* Progress bar */}
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                    style={{ width: `${currentTask.progress}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/80 text-xs text-slate-500 text-center py-4">
                No task currently assigned. Available for delegation.
              </div>
            )}

            {/* Description & Personality */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Agent Profile
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/80">
                {agent.description}
              </p>

              <div className="p-2.5 rounded-lg bg-slate-900/30 border border-slate-800/60 text-xs">
                <span className="text-slate-400 font-semibold">Personality Traits:</span>{' '}
                <span className="text-slate-200">{agent.personality}</span>
              </div>

              {/* Core Capabilities & Tools */}
              <div className="space-y-1.5 pt-1">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  Capabilities & Tools
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {capabilities.map((cap) => (
                    <span
                      key={cap}
                      className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[10px] font-mono capitalize"
                    >
                      {cap}
                    </span>
                  ))}
                  {tools.map((t) => (
                    <span
                      key={t.name}
                      className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-mono"
                    >
                      🛠️ {t.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Finished Work / Output */}
            {agentArtifacts.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Finished Work</span>
                  <span className="text-[10px] font-mono text-cyan-400 font-normal">({agentArtifacts.length})</span>
                </h4>
                <div className="space-y-2">
                  {agentArtifacts.map((art) => (
                    <div
                      key={art.id}
                      className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-cyan-300">{art.title}</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-slate-800 text-cyan-400 uppercase font-bold">
                          {art.type}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300 bg-slate-950/60 p-2 rounded border border-slate-800/60 whitespace-pre-wrap max-h-32 overflow-y-auto font-mono text-[10px] leading-relaxed">
                        {art.content}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Simple Activity Stats */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Activity
              </h4>
              <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-500 text-[9px] block uppercase">Tasks Done</span>
                  <strong className="text-emerald-400 font-bold">{agent.stats.tasksCompleted}</strong>
                </div>
                <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-500 text-[9px] block uppercase">Messages</span>
                  <strong className="text-cyan-400 font-bold">{agent.stats.messagesSent}</strong>
                </div>
                <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-500 text-[9px] block uppercase">Active Time</span>
                  <strong className="text-slate-200 font-bold">{Math.floor(agent.stats.uptimeSeconds / 60)}m</strong>
                </div>
              </div>
            </div>

            {/* Quick Message Form */}
            <form onSubmit={handleSendQuickMessage} className="pt-2">
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Send Direct Message
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={quickMsg}
                  onChange={(e) => setQuickMsg(e.target.value)}
                  placeholder={`Send message to ${agent.name}...`}
                  className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1 transition"
                >
                  <Send className="w-3 h-3" />
                </button>
              </div>
            </form>
          </>
        )}

        {activeTab === 'messages' && (
          <div className="space-y-2 font-mono text-xs">
            {recentMessages.length === 0 ? (
              <div className="text-center py-10 text-slate-600 text-xs">No comms exchanged yet.</div>
            ) : (
              recentMessages.map((m) => (
                <div
                  key={m.id}
                  className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1"
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="font-semibold text-cyan-300">
                      {m.fromAgentId.toUpperCase()} → {m.toAgentId.toUpperCase()}
                    </span>
                    <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-[11px] text-slate-200">{m.content}</p>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'advanced' && (
          <div className="space-y-4">
            {/* AI Provider Status */}
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  AI Provider Engine
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase font-bold ${getStatusBadge(runtimeStatus)}`}>
                  {runtimeStatus}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span>Provider:</span>
                  <select
                    value={agent.providerId || 'mock'}
                    onChange={(e) => AgentManager.setAgentProvider(agent.id, e.target.value)}
                    className="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-cyan-300 font-mono text-[10px] uppercase font-bold focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="antigravity">Antigravity (agy)</option>
                    <option value="gemini">Gemini API</option>
                    <option value="mock">Local Engine</option>
                  </select>
                </div>
                {agent.systemRole && (
                  <div className="text-[11px] text-slate-300 bg-slate-950/40 p-1.5 rounded border border-slate-800/60">
                    <span className="text-slate-500 font-medium block text-[9px] uppercase">System Directive:</span>
                    {agent.systemRole}
                  </div>
                )}
              </div>
              {agent.thoughtBubble && (
                <div className="p-2 rounded bg-slate-950/60 border border-slate-800 text-xs text-sky-300 font-mono italic">
                  💭 {agent.thoughtBubble}
                </div>
              )}
            </div>

            {/* Tools Inventory */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-amber-400" />
                Available Tools
              </h4>
              <div className="space-y-1.5">
                {tools.length === 0 ? (
                  <div className="text-xs text-slate-500 italic">No tools registered</div>
                ) : (
                  tools.map((tl) => (
                    <div
                      key={tl.name}
                      className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-start justify-between text-xs"
                    >
                      <div>
                        <div className="font-mono font-bold text-amber-300">{tl.name}</div>
                        <div className="text-[11px] text-slate-400">{tl.description}</div>
                      </div>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase">
                        {tl.capability}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Diagnostic Session Notes */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                Session Notes & Memory
              </h4>
              <div className="space-y-1.5 font-mono text-xs">
                {runtimeMemories.length === 0 ? (
                  <div className="text-center py-6 text-slate-600 text-xs">
                    No session notes recorded yet.
                  </div>
                ) : (
                  runtimeMemories.map((entry) => (
                    <div
                      key={entry.id}
                      className="p-2 rounded-lg bg-slate-900/50 border border-slate-800/70 space-y-0.5"
                    >
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span className="font-semibold text-emerald-400 uppercase tracking-tight">
                          {entry.type.replace('_', ' ')}
                        </span>
                        <span>{new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      </div>
                      <p className="text-[11px] text-slate-300 break-words leading-tight">
                        {entry.content}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
