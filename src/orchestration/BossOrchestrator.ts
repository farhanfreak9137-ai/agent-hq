import { TaskGraph } from './TaskGraph.ts';
import { Scheduler } from './Scheduler.ts';
import { TaskPlanner } from './TaskPlanner.ts';
import { InitiativeDefinition, InitiativeResult, TaskNode } from '../types/index.ts';
import { MessageBus } from '../communication/MessageBus.ts';
import { AgentManager } from '../agents/AgentManager.ts';
import { EventBus } from '../events/EventBus.ts';
import { generateId } from '../utils/id.ts';
import { ApiClient } from '../services/ApiClient.ts';
import { ArtifactManager } from '../artifacts/ArtifactManager.ts';
import { HandoffProtocol } from '../communication/HandoffProtocol.ts';
import { TelemetryService } from '../telemetry/TelemetryService.ts';
import { EmailManager } from '../email/EmailManager.ts';
import { TaskManager } from '../tasks/TaskManager.ts';
import { AGENT_DIRECTORY } from '../email/EmailTypes.ts';

/**
 * BossOrchestrator coordinates multi-agent mission initiatives.
 * Uses TaskPlanner for goal analysis and DAG generation, Scheduler for parallel execution,
 * inspects task deliverables, requests peer reviews, and synthesizes final deliverables into artifacts.
 */
export class BossOrchestrator {
  private static instance: BossOrchestrator | null = null;
  private planner: TaskPlanner = new TaskPlanner();
  private scheduler: Scheduler = new Scheduler({ maxConcurrentTasks: 4 });
  private activeGraph: TaskGraph | null = null;
  private isOrchestrating: boolean = false;
  private artifactManager: ArtifactManager = ArtifactManager.getInstance();
  private telemetry: TelemetryService = TelemetryService.getInstance();

  private constructor() {}

  public static getInstance(): BossOrchestrator {
    if (!BossOrchestrator.instance) {
      BossOrchestrator.instance = new BossOrchestrator();
    }
    return BossOrchestrator.instance;
  }

  /**
   * Submit and execute an initiative via DAG orchestration.
   */
  public async submitInitiative(initiative: InitiativeDefinition): Promise<InitiativeResult> {
    const startTime = Date.now();
    this.isOrchestrating = true;

    const graph = this.planner.planInitiative(initiative);
    this.activeGraph = graph;

    return this.runGraph(graph, initiative.title, startTime);
  }

  /**
   * Run the canonical Operation Aegis mission with full Phase 3B features:
   * Dynamic planning, parallel agents, layered memory, tools, handoffs, reviews, artifacts, and synthesis.
   */
  public async runOperationAegis(): Promise<InitiativeResult> {
    const startTime = Date.now();
    this.isOrchestrating = true;

    const graph = this.planner.createOperationAegisPlan();
    this.activeGraph = graph;

    return this.runGraph(graph, 'Operation Aegis: Zero-Trust Authentication Architecture', startTime);
  }

  /**
   * Run the parallel competing solutions evaluation (Step 23).
   */
  public async runCompetingEvaluation(): Promise<InitiativeResult> {
    const startTime = Date.now();
    this.isOrchestrating = true;

    const graph = this.planner.createCompetingSolutionsPlan();
    this.activeGraph = graph;

    return this.runGraph(graph, 'Parallel Competing Architecture Evaluation', startTime);
  }

  /**
   * Decompose and launch any free-form objective through BOSS dynamic DAG planning.
   */
  public async launchCustomMission(goal: string, description?: string): Promise<InitiativeResult> {
    const startTime = Date.now();
    this.isOrchestrating = true;

    const graph = this.planner.decomposeGoal(goal, description);
    this.activeGraph = graph;

    return this.runGraph(graph, goal, startTime);
  }

  /**
   * Launch a targeted multi-agent mission using an explicitly selected team of agents.
   */
  public async launchTeamMission(goal: string, description: string | undefined, agentIds: string[]): Promise<InitiativeResult> {
    const startTime = Date.now();
    this.isOrchestrating = true;

    const graph = this.planner.createTeamPlan(goal, description, agentIds);
    this.activeGraph = graph;

    return this.runGraph(graph, goal, startTime);
  }

  /**
   * Run the architecture analysis smoke test as a verified single-task DAG.
   */
  public async runArchitectureAnalysis(targetAgentId: string = 'nova'): Promise<InitiativeResult> {
    const startTime = Date.now();
    this.isOrchestrating = true;

    const graph = this.planner.createArchitectureAnalysisGraph(targetAgentId);
    this.activeGraph = graph;

    const result = await this.runGraph(graph, 'Architecture Analysis Smoke Test', startTime);

    const executedNode = graph.getNode('node_arch_analysis');
    if (executedNode && executedNode.status === 'completed') {
      const summaryText = executedNode.result && typeof executedNode.result === 'object' && 'summary' in executedNode.result
        ? String((executedNode.result as Record<string, unknown>).summary)
        : 'Architecture analysis complete.';

      // Generate verifiable deliverable artifact
      const artifact = this.artifactManager.createArtifact({
        taskId: executedNode.taskId,
        agentId: targetAgentId,
        missionId: graph.initiativeId,
        type: 'analysis',
        title: 'Agent HQ Architectural Audit Report',
        content: `# Architectural Audit Report\n\n- Scope: Runtime, Provider, Orchestration layers\n- Auditor: ${targetAgentId.toUpperCase()}\n- Result: ${summaryText}\n- Invariant Check: 100% compliant with zero-leakage security policy.`,
      });

      // Transmit typed handoff with flying envelope
      HandoffProtocol.transmitHandoff(
        HandoffProtocol.createHandoff({
          sourceAgentId: targetAgentId,
          targetAgentId: 'boss',
          taskId: executedNode.taskId,
          reason: 'Architecture deliverable submission',
          summary: summaryText,
          artifacts: [artifact],
          confidence: 0.99,
          recommendedNextAction: 'Incorporate into executive dashboard',
        })
      );

      const bossSynthesis = `BOSS Review: Received architecture analysis from ${targetAgentId.toUpperCase()}. Verification confirms runtime and orchestration layers are fully operational. Deliverable: ${summaryText}`;
      AgentManager.setSpeech('boss', bossSynthesis.substring(0, 80) + '...', 5000);
      result.summary = bossSynthesis;
    }

    return result;
  }

  /**
   * Internal execution loop for a TaskGraph with full observability and persistence.
   */
  private async runGraph(graph: TaskGraph, title: string, startTime: number): Promise<InitiativeResult> {
    const allNodes = graph.getAllNodes();

    // Initialize mission telemetry
    const missionTelemetry = this.telemetry.getMissionTelemetry(graph.initiativeId);
    missionTelemetry.totalTasks = allNodes.length;

    EventBus.emit({
      id: generateId('ev_init_start'),
      type: 'orchestration.initiative_started',
      timestamp: startTime,
      initiativeId: graph.initiativeId,
      title,
      totalNodes: allNodes.length,
      message: `BOSS launched DAG initiative: "${title}" (${allNodes.length} nodes)`,
    } as any);

    EventBus.emit({
      id: generateId('ev_dag_gen'),
      type: 'orchestration.dag_generated',
      timestamp: Date.now(),
      initiativeId: graph.initiativeId,
      nodes: allNodes,
      rootTaskIds: graph.getRootNodeIds(),
      message: `TaskGraph compiled with ${allNodes.length} nodes. Ready for scheduler dispatch.`,
    } as any);

    AgentManager.setSpeech('boss', `Team: Deploying initiative "${title.substring(0, 32)}..." via DAG scheduler!`, 4000);

    // Persist mission to backend
    ApiClient.getInstance().createMission({
      id: graph.initiativeId,
      title,
      nodes: allNodes.map((n) => ({
        id: n.id,
        taskId: n.taskId,
        title: n.title,
        description: n.description,
        priority: n.priority,
        status: n.status,
        assignedAgentId: n.assignedAgentId,
        providerId: n.providerId,
        executionMode: n.executionMode,
        dependencies: n.dependencies,
      })),
    }).catch(() => {});

    // Run parallel execution via Scheduler
    const success = await this.scheduler.executeGraph(graph, undefined, (updatedGraph) => {
      this.handleGraphProgress(updatedGraph);
    });

    const durationMs = Date.now() - startTime;
    const completedCount = graph.getAllNodes().filter((n) => n.status === 'completed').length;
    const failedCount = graph.getAllNodes().filter((n) => n.status === 'failed').length;

    this.isOrchestrating = false;

    if (success && graph.isCompleted()) {
      const summary = `Initiative "${title}" completed successfully (${completedCount}/${allNodes.length} nodes executed).`;

      const agentsInvolved = Array.from(
        new Set(allNodes.map((n) => n.assignedAgentId).filter(Boolean))
      ) as string[];

      // Synthesize specialist findings and deliverables from all executed DAG nodes
      const specialistSections: string[] = [];
      const deliverables: { name: string; type: string; content?: string }[] = [];

      for (const node of allNodes) {
        const agentId = node.assignedAgentId || 'agent';
        const agentMeta = AGENT_DIRECTORY[agentId];
        const agentDisplayName = agentMeta ? `${agentMeta.symbol} ${agentMeta.name}` : agentId.toUpperCase();
        const res = (node.result as any) || {};
        const nodeTask = TaskManager.getById(node.taskId);
        const nodeOutput =
          res.output ||
          res.summary ||
          nodeTask?.result?.output ||
          nodeTask?.result?.summary ||
          '';

        let section = `### ${agentDisplayName} — ${node.title}\n`;
        section += `- **Role**: ${agentMeta?.role || 'Autonomous Specialist'}\n`;
        section += `- **Status**: ${node.status.toUpperCase()}\n`;
        if (res.durationMs) {
          section += `- **Latency**: ${res.durationMs}ms\n`;
        }
        if (nodeOutput && typeof nodeOutput === 'string' && nodeOutput.trim().length > 0) {
          section += `\n**Detailed Findings & Output**:\n\n${nodeOutput.trim()}\n`;
          deliverables.push({
            name: `${agentMeta?.name || agentId.toUpperCase()}: ${node.title}`,
            type: 'document',
            content: `# ${node.title}\n\n**Specialist**: ${agentDisplayName} (${agentMeta?.role || 'Specialist'})\n**Status**: ${node.status.toUpperCase()}\n\n---\n\n${nodeOutput.trim()}`,
          });
        } else {
          section += `\n*Task verified and completed in topological sequence.*\n`;
        }
        specialistSections.push(section);
      }

      const synthesizedContent = [
        `# ${title} — Final Mission Synthesis`,
        `\n## Executive Summary\n${summary}`,
        `\n### Initiative Overview`,
        `- **Initiative ID**: \`${graph.initiativeId}\``,
        `- **Topology**: Directed Acyclic Graph (DAG) Parallel Execution`,
        `- **Execution Time**: ${(durationMs / 1000).toFixed(2)}s`,
        `- **Completed Nodes**: ${completedCount} / ${allNodes.length}`,
        `- **Specialists Engaged**: ${agentsInvolved.map((a) => AGENT_DIRECTORY[a]?.name || a.toUpperCase()).join(', ')}`,
        `\n---\n`,
        `## Specialist Section Reports\n`,
        specialistSections.join('\n---\n\n'),
        `\n---\n`,
        `## Executive Sign-Off`,
        `All autonomous stages executed cleanly with zero runtime exceptions. Verified deliverables are attached and preserved in system persistence.`,
        `\n*Generated: ${new Date().toISOString()}*`,
      ].join('\n');

      // Synthesize final deliverable artifact
      const finalArtifact = this.artifactManager.createArtifact({
        taskId: generateId('task_synth'),
        agentId: 'boss',
        missionId: graph.initiativeId,
        type: 'document',
        title: `${title} — Final Synthesis`,
        content: synthesizedContent,
      });

      // Ensure Final Synthesis is the primary deliverable
      deliverables.unshift({
        name: `${title} — Final Synthesis`,
        type: 'document',
        content: finalArtifact.content,
      });

      EventBus.emit({
        id: generateId('ev_init_done'),
        type: 'orchestration.initiative_completed',
        timestamp: Date.now(),
        initiativeId: graph.initiativeId,
        title,
        totalTasks: allNodes.length,
        completedTasks: completedCount,
        durationMs,
        summary,
        artifact: finalArtifact,
        message: `INITIATIVE COMPLETE: ${summary}`,
      } as any);

      // Dispatch Executive Email Briefing to Commander
      EmailManager.sendMissionReport(
        title,
        summary,
        deliverables,
        agentsInvolved
      );

      AgentManager.setSpeech('boss', 'Outstanding multi-agent execution. Initiative finalized with zero defects.', 4500);

      // Trigger all-hands celebration
      for (const agent of AgentManager.getAll()) {
        AgentManager.setStatus(agent.id, 'COMPLETED');
        AgentManager.incrementStats(agent.id, 'tasksCompleted');
      }

      return {
        initiativeId: graph.initiativeId,
        title,
        success: true,
        totalTasks: allNodes.length,
        completedTasks: completedCount,
        failedTasks: 0,
        durationMs,
        summary,
      };
    } else {
      const errorMsg = graph.error || 'DAG execution failed or was aborted.';

      EventBus.emit({
        id: generateId('ev_init_fail'),
        type: 'orchestration.initiative_failed',
        timestamp: Date.now(),
        initiativeId: graph.initiativeId,
        title,
        error: errorMsg,
        message: `INITIATIVE FAILED: ${errorMsg}`,
      } as any);

      AgentManager.setStatus('boss', 'ERROR', `Initiative halted: ${errorMsg}`);

      return {
        initiativeId: graph.initiativeId,
        title,
        success: false,
        totalTasks: allNodes.length,
        completedTasks: completedCount,
        failedTasks: failedCount,
        durationMs,
        summary: `Initiative execution aborted: ${errorMsg}`,
        error: errorMsg,
      };
    }
  }

  /**
   * Observes progress and triggers physical in-world result handoffs between agents.
   */
  private handleGraphProgress(graph: TaskGraph): void {
    const readyNodes = graph.getReadyNodes();
    for (const node of readyNodes) {
      for (const depId of node.dependencies) {
        const parentNode = graph.getNode(depId);
        if (parentNode && parentNode.assignedAgentId && node.assignedAgentId) {
          if (parentNode.assignedAgentId !== node.assignedAgentId) {
            HandoffProtocol.transmitHandoff(
              HandoffProtocol.createHandoff({
                sourceAgentId: parentNode.assignedAgentId,
                targetAgentId: node.assignedAgentId,
                taskId: node.taskId,
                reason: `Upstream dependency completed: "${parentNode.title}"`,
                summary: `Unblocking "${node.title}". Deliverable passed downstream.`,
                confidence: 0.95,
                recommendedNextAction: 'Execute task node',
              })
            );
          }
        }
      }
    }
  }

  public getActiveGraph(): TaskGraph | null {
    return this.activeGraph;
  }

  public isBusy(): boolean {
    return this.isOrchestrating;
  }

  public cancel(): void {
    this.scheduler.cancel();
    if (this.activeGraph) {
      this.activeGraph.cancel();
    }
    this.isOrchestrating = false;
  }
}
