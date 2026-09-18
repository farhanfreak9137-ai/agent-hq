import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Focus,
  Home,
  Coffee,
  Send,
  MessageSquare,
  CheckCircle,
  Activity,
  Sparkles,
  User,
  Cpu,
  Wrench,
  Database,
  Rocket,
  Plus,
  Bot,
  AlertCircle,
} from 'lucide-react';
import { AgentModel, TaskPriority, MessageModel } from '../types/index.ts';
import { MessageBus } from '../communication/MessageBus.ts';
import { TaskManager } from '../tasks/TaskManager.ts';
import { AgentManager } from '../agents/AgentManager.ts';
import { EventBus } from '../events/EventBus.ts';
import { SimulationEngine } from '../simulation/SimulationEngine.ts';
import { Camera } from '../world/Camera.ts';
import { ArtifactManager } from '../artifacts/ArtifactManager.ts';
import { ApiClient } from '../services/ApiClient.ts';
import { EmailManager } from '../email/EmailManager.ts';
import { TaskConfirmationModal } from './TaskConfirmationModal.tsx';

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
  const [activeTab, setActiveTab] = useState<'chat' | 'details' | 'messages' | 'advanced'>('chat');
  const [chatInput, setChatInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [, setTick] = useState(0);

  // Task confirmation modal state
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [pendingTaskData, setPendingTaskData] = useState<{
    title: string;
    description: string;
    priority: TaskPriority;
    assignedAgentId: string;
  }>({
    title: '',
    description: '',
    priority: 'MEDIUM',
    assignedAgentId: agent?.id || 'boss',
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = EventBus.on('*', () => setTick((t) => t + 1));
    return unsub;
  }, []);

  useEffect(() => {
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTab, isThinking]);

  if (!agent) return null;

  const runtime = AgentManager.getRuntime(agent.id);
  const runtimeMemories = runtime ? runtime.memory.recent(10) : [];
  const runtimeStatus = runtime ? runtime.status : agent.status;
  const capabilities = agent.capabilities || (runtime ? runtime.capabilities : []);
  const tools = agent.tools || [];

  const agentArtifacts = ArtifactManager.getInstance().getByAgentId(agent.id);
  const currentTask = agent.currentTaskId ? TaskManager.getById(agent.currentTaskId) : null;
  const recentMessages = MessageBus.getMessagesForAgent(agent.id).slice(0, 15);
  const directConversation = MessageBus.getUserConversation(agent.id);
  const allAgents = AgentManager.getAll();
  const agentTasks = TaskManager.getByAgentId(agent.id);
  const completedTasks = agentTasks.filter((t) => t.status === 'COMPLETED');

  const handleFocus = () => {
    camera.focusOnPosition(agent.currentPosition, 1.4);
  };

  const handleReturnDesk = () => {
    simulationEngine.moveAgentTo(agent.id, agent.deskPosition, undefined, agent.facing);
  };

  const handleSendToLounge = () => {
    simulationEngine.moveAgentTo(agent.id, { x: 760, y: 505 });
  };

  // Direct conversational chat with agent
  const handleSendChatMessage = async (textToSend?: string) => {
    const messageText = (textToSend || chatInput).trim();
    if (!messageText || isThinking) return;

    setChatInput('');
    setIsThinking(true);

    // 1. Immediately record user message locally
    MessageBus.sendMessage('farhan', agent.id, messageText, 'general');

    // 2. Set agent state in office world
    AgentManager.setStatus(agent.id, 'THINKING', `Consulting AI for Farhan: "${messageText.substring(0, 20)}..."`);
    AgentManager.setSpeech(agent.id, 'Thinking...', 3000);

    // 3. Prepare conversation history for the AI prompt
    const history = directConversation.slice(-6).map((m) => ({
      role: (m.fromAgentId === 'farhan' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content,
    }));

    try {
      const res = await ApiClient.getInstance().sendAgentChat({
        agentId: agent.id,
        userMessage: messageText,
        history,
        providerId: agent.providerId,
      });

      if (res && res.reply) {
        // Record agent reply in MessageBus
        MessageBus.sendMessage(
          agent.id,
          'farhan',
          res.reply,
          'response',
          undefined,
          res.proposedTask ? { proposedTask: res.proposedTask } : undefined
        );

        AgentManager.setStatus(agent.id, 'COMMUNICATING', `Talking with Farhan`);
        AgentManager.setSpeech(agent.id, res.reply.substring(0, 50) + (res.reply.length > 50 ? '...' : ''), 4000);

        // If a task proposal was returned, we keep it ready for 1-click confirmation
        if (res.proposedTask) {
          setPendingTaskData({
            title: res.proposedTask.title,
            description: res.proposedTask.description,
            priority: (res.proposedTask.priority as TaskPriority) || 'MEDIUM',
            assignedAgentId: agent.id,
          });
        }
      } else {
        // Fallback in-character response if server unreachable
        const fallbackText = `I'm on it, Farhan! Ready to assist with ${agent.role} priorities.`;
        MessageBus.sendMessage(agent.id, 'farhan', fallbackText, 'response');
        AgentManager.setSpeech(agent.id, fallbackText, 3000);
      }
    } catch (err) {
      console.warn('[AgentChat] Error communicating with agent:', err);
      const errReply = `Acknowledged Farhan. Experiencing a momentary network hitch, but standing by for instructions.`;
      MessageBus.sendMessage(agent.id, 'farhan', errReply, 'response');
      AgentManager.setSpeech(agent.id, errReply, 3000);
    } finally {
      setIsThinking(false);
      AgentManager.setStatus(agent.id, agent.currentTaskId ? 'WORKING' : 'IDLE');
    }
  };

  // Open confirmation popup from proposed task or manual trigger
  const handleOpenTaskConfirm = (proposed?: { title: string; description: string; priority: TaskPriority }) => {
    if (proposed) {
      setPendingTaskData({
        title: proposed.title,
        description: proposed.description,
        priority: proposed.priority,
        assignedAgentId: agent.id,
      });
    } else {
      setPendingTaskData({
        title: `Task with ${agent.name}`,
        description: `Collaborative initiative planned with ${agent.name} (${agent.role}).`,
        priority: 'MEDIUM',
        assignedAgentId: agent.id,
      });
    }
    setIsConfirmModalOpen(true);
  };

  // Confirm and launch task
  const handleLaunchConfirmedTask = (details: {
    title: string;
    description: string;
    priority: TaskPriority;
    assignedAgentId: string;
  }) => {
    const newTask = TaskManager.createTask({
      title: details.title,
      description: details.description || 'Task initiated via direct chat.',
      priority: details.priority,
      assignedAgentId: details.assignedAgentId,
    });

    TaskManager.updateStatus(newTask.id, 'IN_PROGRESS');
    AgentManager.assignTask(details.assignedAgentId, newTask.id);
    AgentManager.setStatus(details.assignedAgentId, 'WORKING', `Working on "${details.title}"`);
    AgentManager.setSpeech(details.assignedAgentId, `Initiating task: ${details.title}`, 4000);

    // Record confirmation event in direct chat thread
    MessageBus.sendMessage(
      'farhan',
      details.assignedAgentId,
      `📋 Confirmed task: "${details.title}" [${details.priority}]`,
      'task_handover',
      newTask.id
    );

    MessageBus.sendMessage(
      details.assignedAgentId,
      'farhan',
      `Understood Farhan! I'm starting work on "${details.title}" immediately. You can track live progress in the Task Pipeline.`,
      'response',
      newTask.id
    );

    // Execute the task via AgentManager runtime
    AgentManager.executeTask(details.assignedAgentId, newTask)
      .then((result) => {
        if (result.success) {
          TaskManager.updateStatus(newTask.id, 'COMPLETED', result);
          EmailManager.sendTaskReport(
            details.assignedAgentId,
            details.title,
            result.summary || 'Direct task completed successfully.',
            result.output,
            result.toolsUsed
          );
        } else {
          TaskManager.updateStatus(newTask.id, 'BLOCKED', { error: result.error });
        }
      })
      .catch((err) => {
        console.warn('[TaskConfirmation] Direct task execution error:', err);
        TaskManager.updateStatus(newTask.id, 'BLOCKED', { error: String(err) });
      });
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
        return 'bg-sky-500/10 text-sky-400 border-sky-500/30 animate-pulse';
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
    <>
      <aside className="fixed top-18 right-4 bottom-4 w-92 md:w-104 bg-slate-950/95 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl z-20 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-3.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shadow-lg border"
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
                    runtimeStatus
                  )}`}
                >
                  {runtimeStatus}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                {agent.role} • <span className="text-cyan-400 uppercase font-mono text-[10px]">{agent.providerId || 'mock'}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="flex border-b border-slate-800 bg-slate-900/50 text-xs font-medium text-slate-400">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-2.5 text-center border-b-2 flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'chat'
                ? 'border-cyan-400 text-cyan-300 font-bold bg-cyan-950/20'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
            <span>Direct Chat</span>
            {directConversation.length > 0 && (
              <span className="text-[10px] font-mono px-1 rounded-full bg-slate-800 text-slate-300">
                {directConversation.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('details')}
            className={`flex-1 py-2.5 text-center border-b-2 transition cursor-pointer ${
              activeTab === 'details'
                ? 'border-cyan-400 text-cyan-300 font-bold bg-cyan-950/20'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            Overview
          </button>

          <button
            onClick={() => setActiveTab('messages')}
            className={`flex-1 py-2.5 text-center border-b-2 transition cursor-pointer ${
              activeTab === 'messages'
                ? 'border-cyan-400 text-cyan-300 font-bold bg-cyan-950/20'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            Comms Feed
          </button>

          <button
            onClick={() => setActiveTab('advanced')}
            className={`flex-1 py-2.5 text-center border-b-2 transition cursor-pointer ${
              activeTab === 'advanced'
                ? 'border-cyan-400 text-cyan-300 font-bold bg-cyan-950/20'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            Config
          </button>
        </div>

        {/* Tab 1: Direct Conversational Chat */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col min-h-0 bg-slate-950/60">
            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 font-sans">
              {directConversation.length === 0 ? (
                <div className="text-center py-8 px-4 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto text-2xl">
                    {agent.roleSymbol}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">
                      Direct Channel with {agent.name}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                      Talk, ask questions, or collaboratively plan tasks. Real AI conversational responses via {agent.providerId?.toUpperCase() || 'GEMINI'}.
                    </p>
                  </div>

                  {/* Starter Chips */}
                  <div className="flex flex-wrap justify-center gap-1.5 pt-2">
                    <button
                      onClick={() => handleSendChatMessage(`Hey ${agent.name}, how are you doing?`)}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-cyan-300 transition cursor-pointer"
                    >
                      "How are you doing?"
                    </button>
                    <button
                      onClick={() => handleSendChatMessage(`What are you currently focusing on?`)}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-cyan-300 transition cursor-pointer"
                    >
                      "What are you focusing on?"
                    </button>
                    <button
                      onClick={() => handleSendChatMessage(`Let's plan a task for you to execute.`)}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-cyan-300 transition cursor-pointer"
                    >
                      "Let's plan a task"
                    </button>
                  </div>
                </div>
              ) : (
                directConversation.map((m) => {
                  const isUser = m.fromAgentId === 'farhan';
                  const proposedTask =
                    (m.handoffData as any)?.proposedTask ||
                    (m as any).payload?.proposedTask;

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
                    >
                      <div className="flex items-center gap-1 text-[10px] text-slate-500 px-1">
                        <span className="font-semibold text-slate-400">
                          {isUser ? 'You (Farhan)' : agent.name}
                        </span>
                        <span>•</span>
                        <span>
                          {new Date(m.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <div
                        className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                          isUser
                            ? 'bg-cyan-600 text-white rounded-tr-none shadow-md shadow-cyan-600/10'
                            : 'bg-slate-900/90 text-slate-200 border border-slate-800 rounded-tl-none'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{m.content}</p>

                        {/* Interactive Task Proposal Card */}
                        {proposedTask && (
                          <div className="mt-3 p-3 rounded-xl bg-slate-950/80 border border-cyan-500/30 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-400 flex items-center gap-1">
                                <Rocket className="w-3 h-3" /> Proposed Initiative
                              </span>
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                {proposedTask.priority || 'MEDIUM'}
                              </span>
                            </div>
                            <div className="font-bold text-slate-100 text-xs">
                              {proposedTask.title}
                            </div>
                            {proposedTask.description && (
                              <p className="text-[11px] text-slate-400 line-clamp-3">
                                {proposedTask.description}
                              </p>
                            )}
                            <button
                              onClick={() => handleOpenTaskConfirm(proposedTask)}
                              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md transition cursor-pointer"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>Initiate This Task</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Thinking / Typing indicator */}
              {isThinking && (
                <div className="flex items-center gap-2 text-xs text-cyan-400 p-2 bg-slate-900/50 rounded-xl border border-slate-800/80 w-fit animate-pulse">
                  <Bot className="w-3.5 h-3.5 animate-spin" />
                  <span>{agent.name} is thinking & consulting AI engine...</span>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Chat Input Bar */}
            <div className="p-2.5 bg-slate-900/80 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[11px] px-1">
                <span className="text-slate-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Direct AI Chat with <strong className="text-slate-200">{agent.name}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenTaskConfirm()}
                  className="text-cyan-400 hover:text-cyan-300 text-[10px] font-semibold flex items-center gap-1 transition cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Plan & Initiate Task</span>
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendChatMessage();
                }}
                className="flex gap-1.5"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={`Talk with ${agent.name}...`}
                  disabled={isThinking}
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isThinking}
                  className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1 shadow-md shadow-cyan-600/20 transition cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Tab 2: Overview & Telemetry */}
        {activeTab === 'details' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Quick World Actions */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={handleFocus}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-cyan-400 text-[11px] font-medium transition cursor-pointer"
              >
                <Focus className="w-4 h-4 mb-1 text-cyan-400" />
                Focus Camera
              </button>
              <button
                onClick={handleReturnDesk}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-emerald-400 text-[11px] font-medium transition cursor-pointer"
              >
                <Home className="w-4 h-4 mb-1 text-emerald-400" />
                Return to Desk
              </button>
              <button
                onClick={handleSendToLounge}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-purple-400 text-[11px] font-medium transition cursor-pointer"
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
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                    style={{ width: `${currentTask.progress}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/80 text-xs text-slate-500 text-center py-4">
                No task currently assigned. Available for direct assignment.
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

              {/* Capabilities */}
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

            {/* Completed Tasks & Deliverables */}
            <div className="space-y-2 pt-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  Completed Tasks & Deliverables
                </span>
                <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                  ({completedTasks.length})
                </span>
              </h4>

              {completedTasks.length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/80 text-xs text-slate-500 text-center py-4">
                  No completed tasks yet. Assign a task or initiate one from Direct Chat.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {completedTasks.map((t) => {
                    let res = t.result;
                    if (typeof res === 'string') {
                      try {
                        res = JSON.parse(res);
                      } catch {}
                    }
                    const summary = res?.summary || 'Task completed successfully.';
                    const output = res?.output || '';
                    const duration = res?.durationMs ? `${(res.durationMs / 1000).toFixed(1)}s` : '';

                    return (
                      <div
                        key={t.id}
                        className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-200 text-xs leading-tight">
                            {t.title}
                          </span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase font-bold">
                            COMPLETED
                          </span>
                        </div>

                        {/* Summary Deliverable */}
                        <p className="text-[11px] text-slate-300 bg-slate-950/60 p-2 rounded-lg border border-slate-800/60 leading-relaxed">
                          {summary}
                        </p>

                        {/* Technical Output if present */}
                        {output && (
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">
                              Technical Deliverable Output:
                            </span>
                            <pre className="text-[10px] font-mono text-slate-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 whitespace-pre-wrap max-h-36 overflow-y-auto leading-relaxed select-text">
                              {output}
                            </pre>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1">
                          <span>{t.completedAt ? new Date(t.completedAt).toLocaleTimeString() : ''}</span>
                          {duration && <span>Duration: {duration}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Finished Artifacts */}
            {agentArtifacts.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Finished Deliverables</span>
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
          </div>
        )}

        {/* Tab 3: Comms Feed */}
        {activeTab === 'messages' && (
          <div className="flex-1 overflow-y-auto p-3 space-y-2 font-mono text-xs">
            {recentMessages.length === 0 ? (
              <div className="text-center py-10 text-slate-600 text-xs">No inter-agent envelopes logged yet.</div>
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

        {/* Tab 4: Configuration */}
        {activeTab === 'advanced' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                    value={agent.providerId || 'gemini'}
                    onChange={(e) => AgentManager.setAgentProvider(agent.id, e.target.value)}
                    className="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-cyan-300 font-mono text-[10px] uppercase font-bold focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="gemini">Gemini API (Cloud)</option>
                    <option value="antigravity">Google Antigravity (Local)</option>
                    <option value="mock">Local Deterministic</option>
                  </select>
                </div>
                {agent.systemRole && (
                  <div className="text-[11px] text-slate-300 bg-slate-950/40 p-1.5 rounded border border-slate-800/60">
                    <span className="text-slate-500 font-medium block text-[9px] uppercase">System Directive:</span>
                    {agent.systemRole}
                  </div>
                )}
              </div>
            </div>

            {/* Diagnostic Session Notes */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                Session Memory Notes
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
      </aside>

      {/* Task Confirmation Popup Modal */}
      <TaskConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleLaunchConfirmedTask}
        initialData={pendingTaskData}
        agents={allAgents}
      />
    </>
  );
};
