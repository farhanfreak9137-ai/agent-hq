import {
  AgentTelemetry,
  MissionTelemetry,
  CorrelationContext,
} from '../types/index.ts';
import { EventBus } from '../events/EventBus.ts';
import { generateId } from '../utils/id.ts';

export interface RecordExecutionOptions {
  correlation: CorrelationContext;
  agentId: string;
  providerId: string;
  toolId?: string;
  durationMs: number;
  success: boolean;
  isRetry?: boolean;
  tokens?: number;
  cost?: number;
}

/**
 * TelemetryService provides comprehensive observability across agents,
 * missions, providers, and tools with correlation ID tracking.
 */
export class TelemetryService {
  private static instance: TelemetryService | null = null;

  private agentTelemetry: Map<string, AgentTelemetry> = new Map();
  private missionTelemetry: Map<string, MissionTelemetry> = new Map();

  // Aggregate metrics
  private totalTaskCount: number = 0;
  private completedTaskCount: number = 0;
  private failedTaskCount: number = 0;
  private retryCount: number = 0;
  private activeConcurrency: number = 0;
  private queueDepth: number = 0;

  // Latency distributions (in ms)
  private taskLatencies: number[] = [];
  private toolLatencies: number[] = [];
  private providerLatencies: number[] = [];

  private constructor() {
    this.subscribeToEvents();
  }

  public static getInstance(): TelemetryService {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }

  private subscribeToEvents(): void {
    EventBus.on('*', (ev: any) => {
      if (ev.type === 'task.started' || ev.type === 'runtime.started') {
        this.activeConcurrency++;
      } else if (ev.type === 'task.completed' || ev.type === 'runtime.completed' || ev.type === 'task.failed') {
        this.activeConcurrency = Math.max(0, this.activeConcurrency - 1);
      }

      if (ev.type === 'orchestration.task_ready') {
        this.queueDepth++;
      } else if (ev.type === 'task.started') {
        this.queueDepth = Math.max(0, this.queueDepth - 1);
      }
    });
  }

  /**
   * Get or initialize telemetry for an individual agent.
   */
  public getAgentTelemetry(agentId: string): AgentTelemetry {
    let stats = this.agentTelemetry.get(agentId);
    if (!stats) {
      stats = {
        agentId,
        tasksCompleted: 0,
        tasksFailed: 0,
        totalDurationMs: 0,
        avgDurationMs: 0,
        toolUsage: {},
        providerUsage: {},
        messagesSent: 0,
        messagesReceived: 0,
        reviewCycles: 0,
        currentStatus: 'IDLE',
      };
      this.agentTelemetry.set(agentId, stats);
    }
    return stats;
  }

  /**
   * Get or initialize mission-level telemetry.
   */
  public getMissionTelemetry(missionId: string): MissionTelemetry {
    let mission = this.missionTelemetry.get(missionId);
    if (!mission) {
      mission = {
        missionId,
        totalTasks: 0,
        completed: 0,
        failed: 0,
        blocked: 0,
        running: 0,
        avgDurationMs: 0,
        parallelismFactor: 1.0,
        providerUsage: {},
        estimatedCostTokens: 0,
        startedAt: Date.now(),
      };
      this.missionTelemetry.set(missionId, mission);
    }
    return mission;
  }

  /**
   * Record task execution metrics with full correlation ID propagation.
   */
  public recordExecution(options: RecordExecutionOptions): void {
    this.totalTaskCount++;
    if (options.success) {
      this.completedTaskCount++;
    } else {
      this.failedTaskCount++;
    }
    if (options.isRetry) {
      this.retryCount++;
    }

    this.taskLatencies.push(options.durationMs);
    if (this.taskLatencies.length > 500) this.taskLatencies.shift();

    // 1. Update Agent Telemetry
    const agentStats = this.getAgentTelemetry(options.agentId);
    if (options.success) {
      agentStats.tasksCompleted++;
    } else {
      agentStats.tasksFailed++;
    }
    agentStats.totalDurationMs += options.durationMs;
    const totalRuns = agentStats.tasksCompleted + agentStats.tasksFailed;
    agentStats.avgDurationMs = Math.round(agentStats.totalDurationMs / Math.max(1, totalRuns));

    if (options.toolId) {
      agentStats.toolUsage[options.toolId] = (agentStats.toolUsage[options.toolId] || 0) + 1;
    }
    agentStats.providerUsage[options.providerId] = (agentStats.providerUsage[options.providerId] || 0) + 1;

    // 2. Update Mission Telemetry
    if (options.correlation.missionId) {
      const missionStats = this.getMissionTelemetry(options.correlation.missionId);
      if (options.success) {
        missionStats.completed++;
      } else {
        missionStats.failed++;
      }
      missionStats.providerUsage[options.providerId] = (missionStats.providerUsage[options.providerId] || 0) + 1;
      if (options.tokens) {
        missionStats.estimatedCostTokens += options.tokens;
      }
      missionStats.avgDurationMs = Math.round(
        (missionStats.avgDurationMs * (missionStats.completed + missionStats.failed - 1) + options.durationMs) /
          Math.max(1, missionStats.completed + missionStats.failed)
      );
    }

    // 3. Emit correlated telemetry event
    EventBus.emit({
      id: generateId('ev_telemetry'),
      type: 'telemetry.execution_recorded',
      timestamp: Date.now(),
      correlation: options.correlation,
      agentId: options.agentId,
      durationMs: options.durationMs,
      success: options.success,
      message: `Telemetry [${options.correlation.taskId || 'task'}]: ${options.durationMs}ms (success=${options.success})`,
    } as any);
  }

  public recordMessageEvent(fromAgentId: string, toAgentId: string): void {
    const fromStats = this.getAgentTelemetry(fromAgentId);
    fromStats.messagesSent++;
    const toStats = this.getAgentTelemetry(toAgentId);
    toStats.messagesReceived++;
  }

  public recordReviewCycle(agentId: string): void {
    const stats = this.getAgentTelemetry(agentId);
    stats.reviewCycles++;
  }

  public getSystemMetrics(): {
    totalTasks: number;
    successRate: number;
    failureRate: number;
    retryRate: number;
    activeConcurrency: number;
    queueDepth: number;
    avgTaskLatencyMs: number;
  } {
    const total = Math.max(1, this.totalTaskCount);
    const avgLatency =
      this.taskLatencies.length > 0
        ? Math.round(this.taskLatencies.reduce((a, b) => a + b, 0) / this.taskLatencies.length)
        : 0;

    return {
      totalTasks: this.totalTaskCount,
      successRate: Math.round((this.completedTaskCount / total) * 100),
      failureRate: Math.round((this.failedTaskCount / total) * 100),
      retryRate: Math.round((this.retryCount / total) * 100),
      activeConcurrency: this.activeConcurrency,
      queueDepth: this.queueDepth,
      avgTaskLatencyMs: avgLatency,
    };
  }

  public getAllAgentTelemetry(): AgentTelemetry[] {
    return Array.from(this.agentTelemetry.values());
  }

  public clear(): void {
    this.agentTelemetry.clear();
    this.missionTelemetry.clear();
    this.totalTaskCount = 0;
    this.completedTaskCount = 0;
    this.failedTaskCount = 0;
    this.retryCount = 0;
    this.activeConcurrency = 0;
    this.queueDepth = 0;
    this.taskLatencies = [];
  }
}
