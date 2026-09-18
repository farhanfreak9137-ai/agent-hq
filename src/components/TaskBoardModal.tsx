import React, { useState } from 'react';
import {
  X,
  Plus,
  CheckCircle2,
  Clock,
  PlayCircle,
  AlertCircle,
  Trash2,
  Copy,
  Check,
  Cpu,
  Wrench,
  FileText,
  Terminal,
  Activity,
  Download,
  ExternalLink,
  FolderCheck,
} from 'lucide-react';
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
  const [copiedOutput, setCopiedOutput] = useState(false);
  const [detailTab, setDetailTab] = useState<'deliverables' | 'description' | 'logs'>('deliverables');

  const handleClearAll = async () => {
    if (window.confirm(`Clear all ${tasks.length} initiatives and test tasks from the pipeline?`)) {
      await TaskManager.clearAllTasks();
      onClose();
    }
  };

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

  // Normalize result if string or object
  let parsedResult: any = selectedTask?.result;
  if (typeof parsedResult === 'string') {
    try {
      parsedResult = JSON.parse(parsedResult);
    } catch {}
  }

  const assignedAgent = selectedTask ? agents.find((a) => a.id === selectedTask.assignedAgentId) : null;
  const isCompleted = selectedTask?.status === 'COMPLETED';
  const executionMode = selectedTask?.executionMode || parsedResult?.executionMode || 'mock';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-6xl max-h-[90vh] bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
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
            {tasks.length > 0 && (
              <button
                onClick={handleClearAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 text-red-300 hover:text-white text-xs font-semibold shadow-sm transition cursor-pointer"
                title="Clear all tasks from the pipeline"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                <span>Clear Board</span>
              </button>
            )}
            <button
              onClick={onOpenCreateTask}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Task</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Kanban Board Columns */}
        <div className="flex-1 overflow-x-auto p-4 grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-950/50 min-h-64">
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
                      const taskAgent = agents.find((a) => a.id === task.assignedAgentId);
                      const isSelected = selectedTask?.id === task.id;

                      return (
                        <div
                          key={task.id}
                          onClick={() => {
                            setSelectedTask(task);
                            setDetailTab(task.status === 'COMPLETED' ? 'deliverables' : 'description');
                          }}
                          className={`p-3 rounded-xl border cursor-pointer transition shadow-sm space-y-2 ${
                            isSelected
                              ? 'bg-slate-900 border-cyan-500/80 ring-1 ring-cyan-500/30 shadow-cyan-950/40'
                              : 'bg-slate-900/80 hover:bg-slate-900 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase ${getPriorityBadge(
                                task.priority
                              )}`}
                            >
                              {task.priority}
                            </span>

                            {taskAgent && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectAgentById(taskAgent.id);
                                  onClose();
                                }}
                                className="flex items-center gap-1 text-[11px] font-bold text-cyan-300 hover:text-cyan-200"
                              >
                                <span>{taskAgent.roleSymbol}</span>
                                <span>{taskAgent.name}</span>
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
                              className="h-full bg-cyan-400 transition-all duration-300"
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

        {/* Selected Task Inspection & Deliverables Drawer */}
        {selectedTask && (
          <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-col space-y-3 max-h-72 overflow-y-auto animate-in slide-in-from-bottom-2 duration-150">
            {/* Drawer Header */}
            <div className="flex items-start justify-between pb-2 border-b border-slate-800/80">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-extrabold text-cyan-400 uppercase tracking-wide">
                    Detail Inspection: {selectedTask.title}
                  </span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase font-bold ${
                    selectedTask.status === 'COMPLETED'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                  }`}>
                    {selectedTask.status} ({selectedTask.progress}%)
                  </span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${
                    executionMode === 'real'
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {executionMode === 'real' ? '⚡ REAL MODEL EXECUTION' : 'SIMULATED MOCK'}
                  </span>
                  {assignedAgent && (
                    <span className="text-[11px] text-slate-300 font-semibold flex items-center gap-1">
                      {assignedAgent.roleSymbol} {assignedAgent.name} ({assignedAgent.role})
                    </span>
                  )}
                </div>

                {/* Sub-tabs */}
                <div className="flex items-center gap-3 text-[11px] font-semibold pt-1">
                  <button
                    onClick={() => setDetailTab('deliverables')}
                    className={`pb-0.5 transition cursor-pointer ${
                      detailTab === 'deliverables'
                        ? 'border-b-2 border-cyan-400 text-cyan-300 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Deliverables & Technical Output
                  </button>
                  <button
                    onClick={() => setDetailTab('description')}
                    className={`pb-0.5 transition cursor-pointer ${
                      detailTab === 'description'
                        ? 'border-b-2 border-cyan-400 text-cyan-300 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Original Scope & Directives
                  </button>
                  <button
                    onClick={() => setDetailTab('logs')}
                    className={`pb-0.5 transition cursor-pointer ${
                      detailTab === 'logs'
                        ? 'border-b-2 border-cyan-400 text-cyan-300 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Lifecycle Logs ({selectedTask.logs.length})
                  </button>
                </div>
              </div>

              <button
                onClick={() => setSelectedTask(null)}
                className="text-xs text-slate-400 hover:text-slate-100 hover:underline cursor-pointer"
              >
                Close Details
              </button>
            </div>

            {/* Tab 1: Deliverables & Output */}
            {detailTab === 'deliverables' && (
              <div className="space-y-2.5">
                {isCompleted && parsedResult ? (
                  <div className="space-y-2.5">
                    {/* Summary Callout */}
                    <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-emerald-300">
                          Execution Summary Deliverable
                        </div>
                        <p className="text-xs text-slate-200 leading-relaxed">
                          {parsedResult.summary || 'Task completed successfully and deliverables generated.'}
                        </p>
                      </div>
                    </div>

                    {/* Metadata tags */}
                    <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono">
                      {parsedResult.toolsUsed && parsedResult.toolsUsed.length > 0 && (
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <span>Tools Used:</span>
                          {parsedResult.toolsUsed.map((tool: string) => (
                            <span key={tool} className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                              🛠️ {tool}
                            </span>
                          ))}
                        </div>
                      )}
                      {parsedResult.durationMs && (
                        <div className="text-slate-400">
                          <span>Duration:</span> <strong className="text-slate-200">{(parsedResult.durationMs / 1000).toFixed(1)}s</strong>
                        </div>
                      )}
                    </div>

                    {/* Files Created in Workspace Callout */}
                    {parsedResult.filesCreated && parsedResult.filesCreated.length > 0 && (
                      <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/40 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
                          <FolderCheck className="w-4 h-4 text-cyan-400" />
                          <span>Workspace Files Created on Disk ({parsedResult.filesCreated.length})</span>
                        </div>
                        <div className="space-y-1.5">
                          {parsedResult.filesCreated.map((file: any) => (
                            <div
                              key={file.relativePath}
                              className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-xs"
                            >
                              <div className="flex items-center gap-2 overflow-hidden">
                                <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                                <span className="font-mono text-slate-200 truncate">
                                  workspace/{file.relativePath}
                                </span>
                                <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                                  {file.sizeBytes > 1024 ? `${(file.sizeBytes / 1024).toFixed(1)} KB` : `${file.sizeBytes} B`}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <a
                                  href={`http://localhost:3001/api/workspace/files/${encodeURIComponent(file.relativePath)}?download=true`}
                                  download
                                  className="flex items-center gap-1 px-2 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-semibold transition cursor-pointer"
                                >
                                  <Download className="w-3 h-3" />
                                  <span>Download</span>
                                </a>
                                <a
                                  href={`http://localhost:3001/api/workspace/files/${encodeURIComponent(file.relativePath)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-semibold transition cursor-pointer"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span>View</span>
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Technical Output Box */}
                    {parsedResult.output && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase text-slate-400 flex items-center gap-1">
                            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                            Technical Deliverables & Output
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(parsedResult.output);
                              setCopiedOutput(true);
                              setTimeout(() => setCopiedOutput(false), 2000);
                            }}
                            className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-semibold transition cursor-pointer"
                          >
                            {copiedOutput ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy Deliverable</span>
                              </>
                            )}
                          </button>
                        </div>
                        <pre className="p-3 rounded-lg bg-slate-950/90 border border-slate-800 text-[11px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto select-text">
                          {parsedResult.output}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-500 text-xs font-mono">
                    {selectedTask.status === 'IN_PROGRESS'
                      ? 'Task is currently executing in background. Deliverables will be presented here upon completion.'
                      : 'No execution deliverables recorded for this task yet.'}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Original Scope & Description */}
            {detailTab === 'description' && (
              <div className="space-y-2">
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Initiative Requirements</span>
                  <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {selectedTask.description || 'No detailed instructions provided.'}
                  </p>
                </div>
              </div>
            )}

            {/* Tab 3: Lifecycle Logs */}
            {detailTab === 'logs' && (
              <div className="max-h-36 overflow-y-auto font-mono text-[11px] text-slate-300 space-y-1 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                {selectedTask.logs.map((log) => (
                  <div key={log.id} className="text-slate-400 leading-relaxed">
                    <span className="text-cyan-400">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                    <strong className="text-slate-200">@{log.agentId.toUpperCase()}:</strong> {log.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
