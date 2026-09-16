import React, { useState, useEffect } from 'react';
import { AgentModel, TaskNode, Artifact, HumanApprovalRequest } from '../types/index.ts';
import { BossOrchestrator } from '../orchestration/BossOrchestrator.ts';
import { TelemetryService } from '../telemetry/TelemetryService.ts';
import { ArtifactManager } from '../artifacts/ArtifactManager.ts';
import { HumanApprovalManager } from '../security/HumanApprovalManager.ts';
import { EventBus } from '../events/EventBus.ts';
import { EventTimeline } from './EventTimeline.tsx';
import { MISSION_TEMPLATES } from '../orchestration/MissionTemplates.ts';

interface MissionDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  agents: AgentModel[];
}

export const MissionDashboard: React.FC<MissionDashboardProps> = ({ isOpen, onClose, agents }) => {
  const [activeGraphNodes, setActiveGraphNodes] = useState<TaskNode[]>([]);
  const [missionTitle, setMissionTitle] = useState<string>('Operation Aegis: Zero-Trust Authentication Architecture');
  const [missionStatus, setMissionStatus] = useState<string>('IDLE');
  const [artifacts, setArtifacts] = useState<Artifact[]>(() => ArtifactManager.getInstance().getAll());
  const [pendingApprovals, setPendingApprovals] = useState<HumanApprovalRequest[]>(() =>
    HumanApprovalManager.getInstance().getPendingRequests()
  );
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>('software_development');
  const [showCustomModal, setShowCustomModal] = useState<boolean>(false);
  const [customGoal, setCustomGoal] = useState<string>('');
  const [customDesc, setCustomDesc] = useState<string>('');

  const telemetryService = TelemetryService.getInstance();
  const [metrics, setMetrics] = useState(telemetryService.getSystemMetrics());

  // Listen to orchestration, artifacts, and approval events
  useEffect(() => {
    const unsub = EventBus.on('*', () => {
      const boss = BossOrchestrator.getInstance();
      const graph = boss.getActiveGraph();
      if (graph) {
        setActiveGraphNodes(graph.getAllNodes());
        setMissionTitle(graph.name);
        setMissionStatus(graph.status.toUpperCase());
      } else if (boss.isBusy()) {
        setMissionStatus('RUNNING');
      }

      setArtifacts(ArtifactManager.getInstance().getAll());
      setPendingApprovals(HumanApprovalManager.getInstance().getPendingRequests());
      setMetrics(telemetryService.getSystemMetrics());
    });

    return unsub;
  }, [telemetryService]);

  if (!isOpen) return null;

  const completedNodes = activeGraphNodes.filter((n) => n.status === 'completed').length;
  const totalNodes = activeGraphNodes.length;
  const progressPercent = totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0;

  const handleApprove = (id: string) => {
    HumanApprovalManager.getInstance().approve(id, 'human_operator');
    setPendingApprovals(HumanApprovalManager.getInstance().getPendingRequests());
  };

  const handleReject = (id: string) => {
    HumanApprovalManager.getInstance().reject(id, 'human_operator', 'Operator rejected execution');
    setPendingApprovals(HumanApprovalManager.getInstance().getPendingRequests());
  };

  const handleLaunchTemplate = () => {
    const tmpl = MISSION_TEMPLATES[selectedTemplateKey];
    if (tmpl) {
      BossOrchestrator.getInstance().submitInitiative(tmpl);
    }
  };

  const handleLaunchAegis = () => {
    BossOrchestrator.getInstance().runOperationAegis();
  };

  const handleLaunchCompeting = () => {
    BossOrchestrator.getInstance().runCompetingEvaluation();
  };

  const handleLaunchCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customGoal.trim()) return;
    BossOrchestrator.getInstance().launchCustomMission(customGoal.trim(), customDesc.trim() || undefined);
    setShowCustomModal(false);
    setCustomGoal('');
    setCustomDesc('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 select-none">
      <div className="flex flex-col w-full max-w-6xl h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden relative">
        {/* Custom Initiative Modal */}
        {showCustomModal && (
          <div className="absolute inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-6">
            <form
              onSubmit={handleLaunchCustom}
              className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 text-xs"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold">✨</span>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">BOSS Custom Mission Planner</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Mission Objective / Goal</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Audit Cryptographic Tokens & Hardened Session Storage"
                  value={customGoal}
                  onChange={(e) => setCustomGoal(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Scope Details & Deliverable Requirements</label>
                <textarea
                  rows={3}
                  placeholder="Describe constraints, domain scope, and key deliverables for multi-agent DAG decomposition..."
                  value={customDesc}
                  onChange={(e) => setCustomDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-slate-400 text-[11px] leading-relaxed">
                <span className="text-cyan-400 font-semibold">Autonomous Decomposition:</span> BOSS will automatically break down this objective into a 5-phase DAG (Scoping → Research → Implementation → Security Verification → Peer Review → Executive Synthesis) with capability-matched agents.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow transition"
                >
                  Decompose & Launch DAG
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 text-lg">⚡</span>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">Live Multi-Agent Mission Operations</h2>
              <p className="text-xs text-slate-400">{missionTitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase ${
                missionStatus === 'COMPLETED'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : missionStatus === 'RUNNING'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 animate-pulse'
                  : missionStatus === 'FAILED'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {missionStatus}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2.5 bg-slate-900/60 border-b border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={handleLaunchAegis}
              className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium shadow transition-all flex items-center gap-1.5"
            >
              <span>🚀</span> Run Operation Aegis
            </button>
            <button
              onClick={handleLaunchCompeting}
              className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium shadow transition-all flex items-center gap-1.5"
            >
              <span>⚖️</span> Competing Solutions
            </button>
            <button
              onClick={() => setShowCustomModal(true)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow transition-all flex items-center gap-1.5"
            >
              <span>✨</span> Custom Initiative
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Template:</span>
            <select
              value={selectedTemplateKey}
              onChange={(e) => setSelectedTemplateKey(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 outline-none focus:border-cyan-500"
            >
              {Object.entries(MISSION_TEMPLATES).map(([key, tmpl]) => (
                <option key={key} value={key}>
                  {tmpl.title}
                </option>
              ))}
            </select>
            <button
              onClick={handleLaunchTemplate}
              className="px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium transition-all"
            >
              Deploy Template
            </button>
          </div>
        </div>

        {/* Human Approvals Banner */}
        {pendingApprovals.length > 0 && (
          <div className="px-6 py-3 bg-purple-950/60 border-b border-purple-800/80 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-purple-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                Human Approval Required ({pendingApprovals.length} pending action)
              </span>
            </div>
            {pendingApprovals.map((req) => {
              const p = req.parameters || {};
              const company = (p.company as string) || (p.recipient as string);
              const opp = p.opportunity as string;
              const service = p.recommendedService as string;
              const subject = p.subject as string;
              const body = p.body as string;
              const isOutreach = req.toolId.includes('outreach') || !!subject || !!body;

              return (
                <div key={req.id} className="flex flex-col gap-2 bg-slate-900/95 p-3 rounded-xl border border-purple-800/60 text-xs shadow-lg">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold tracking-wider text-[10px] uppercase">
                        Awaiting Farhan's Approval
                      </span>
                      <span className="text-slate-300 font-semibold">{req.agentId.toUpperCase()}</span>
                      <span className="text-purple-400 font-mono font-bold">[{req.toolName}]</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApprove(req.id)}
                        className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow transition cursor-pointer"
                      >
                        APPROVE
                      </button>
                      <button
                        onClick={() => handleReject(req.id)}
                        className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow transition cursor-pointer"
                      >
                        REJECT
                      </button>
                    </div>
                  </div>

                  {isOutreach ? (
                    <div className="space-y-1.5 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 text-[11px]">
                      {company && (
                        <div>
                          <span className="text-slate-400 font-medium">Company:</span>{' '}
                          <span className="text-white font-semibold">{company}</span>
                        </div>
                      )}
                      {opp && (
                        <div>
                          <span className="text-slate-400 font-medium">Opportunity:</span>{' '}
                          <span className="text-purple-300 font-semibold">{opp}</span>
                        </div>
                      )}
                      {service && (
                        <div>
                          <span className="text-slate-400 font-medium">Recommended Service:</span>{' '}
                          <span className="text-emerald-300 font-semibold">{service}</span>
                        </div>
                      )}
                      {subject && (
                        <div>
                          <span className="text-slate-400 font-medium">Subject:</span>{' '}
                          <span className="text-sky-300 font-semibold">{subject}</span>
                        </div>
                      )}
                      {body && (
                        <div className="mt-1 pt-1 border-t border-slate-800/80">
                          <span className="text-slate-400 font-medium block mb-1">Generated Email Draft:</span>
                          <pre className="whitespace-pre-wrap font-sans text-slate-200 bg-slate-900/80 p-2.5 rounded border border-slate-800/50 leading-relaxed text-[11px]">
                            {body}
                          </pre>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400">{req.reason}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Telemetry HUD Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 px-6 py-3 bg-slate-950/40 border-b border-slate-800 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/50">
            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Success Rate</span>
            <div className="text-base font-bold text-emerald-400 mt-0.5">{metrics.successRate}%</div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/50">
            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Avg Latency</span>
            <div className="text-base font-bold text-cyan-400 mt-0.5">{metrics.avgTaskLatencyMs}ms</div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/50">
            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Concurrency</span>
            <div className="text-base font-bold text-indigo-400 mt-0.5">{metrics.activeConcurrency} tasks</div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/50">
            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Queue Depth</span>
            <div className="text-base font-bold text-amber-400 mt-0.5">{metrics.queueDepth}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/50">
            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Total Deliverables</span>
            <div className="text-base font-bold text-fuchsia-400 mt-0.5">{artifacts.length} items</div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/50">
            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">DAG Progress</span>
            <div className="text-base font-bold text-white mt-0.5">
              {completedNodes}/{totalNodes} ({progressPercent}%)
            </div>
          </div>
        </div>

        {/* Main Content Layout */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-6 overflow-hidden">
          {/* Column 1 & 2: Task Graph & Artifacts */}
          <div className="lg:col-span-2 flex flex-col gap-4 overflow-hidden">
            {/* Task Graph Topology */}
            <div className="flex-1 flex flex-col bg-slate-950/60 border border-slate-800 rounded-xl p-4 overflow-hidden">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Execution DAG Topology ({activeGraphNodes.length} Nodes)
                </span>
                <span className="text-[11px] text-slate-400">
                  {completedNodes} completed · {activeGraphNodes.filter((n) => n.status === 'running').length} running
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {activeGraphNodes.length === 0 ? (
                  <div className="text-center text-slate-500 italic py-12">
                    No active DAG executing. Launch Operation Aegis or a template above!
                  </div>
                ) : (
                  activeGraphNodes.map((node) => (
                    <div
                      key={node.id}
                      className={`p-3 rounded-lg border flex items-center justify-between gap-3 text-xs transition-all ${
                        node.status === 'completed'
                          ? 'bg-emerald-950/20 border-emerald-800/60 text-emerald-300'
                          : node.status === 'running'
                          ? 'bg-cyan-950/30 border-cyan-500 text-cyan-200 shadow-lg shadow-cyan-950/40 animate-pulse'
                          : node.status === 'failed'
                          ? 'bg-rose-950/20 border-rose-800/60 text-rose-300'
                          : node.status === 'blocked'
                          ? 'bg-slate-800/30 border-slate-700/40 text-slate-500'
                          : 'bg-slate-900/50 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            node.status === 'completed'
                              ? 'bg-emerald-400'
                              : node.status === 'running'
                              ? 'bg-cyan-400'
                              : node.status === 'failed'
                              ? 'bg-rose-400'
                              : node.status === 'blocked'
                              ? 'bg-slate-600'
                              : 'bg-slate-700'
                          }`}
                        />
                        <div>
                          <div className="font-semibold text-slate-200">{node.title}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>Agent: {node.assignedAgentId?.toUpperCase() || 'UNASSIGNED'}</span>
                            {node.dependencies.length > 0 && (
                              <span>· Depends on: {node.dependencies.join(', ')}</span>
                            )}
                            {node.retryCount > 0 && (
                              <span className="text-amber-400">· Retries: {node.retryCount}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800/80">
                        {node.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Generated Deliverables / Artifacts */}
            <div className="h-44 bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs font-bold uppercase text-slate-300">
                <span>Verifiable Deliverable Artifacts ({artifacts.length})</span>
                <span className="text-[10px] text-slate-500">Click to view content</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {artifacts.length === 0 ? (
                  <div className="text-slate-500 italic text-center text-xs py-4">No artifacts generated yet.</div>
                ) : (
                  artifacts.map((art) => (
                    <div
                      key={art.id}
                      onClick={() => setSelectedArtifact(art)}
                      className="p-2 rounded bg-slate-900 hover:bg-slate-800/80 border border-slate-800 cursor-pointer flex items-center justify-between text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 font-mono font-bold uppercase">
                          {art.type}
                        </span>
                        <span className="font-medium text-slate-200 truncate">{art.title}</span>
                      </div>
                      <span className="text-[10px] text-slate-500">by {art.agentId.toUpperCase()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Column 3: Live Event Timeline */}
          <div className="flex flex-col h-full overflow-hidden">
            <EventTimeline maxItems={60} />
          </div>
        </div>
      </div>

      {/* Artifact Preview Modal */}
      {selectedArtifact && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/90 p-6">
          <div className="w-full max-w-2xl max-h-[80vh] bg-slate-900 border border-slate-700 rounded-xl flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3 bg-slate-950 border-b border-slate-800">
              <div>
                <span className="text-[10px] font-mono uppercase text-cyan-400 font-bold tracking-wider">
                  {selectedArtifact.type} artifact
                </span>
                <h3 className="text-sm font-bold text-white">{selectedArtifact.title}</h3>
              </div>
              <button
                onClick={() => setSelectedArtifact(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-950/40">
              {selectedArtifact.content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
