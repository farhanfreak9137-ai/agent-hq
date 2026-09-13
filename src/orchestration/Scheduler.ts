import { TaskGraph } from './TaskGraph.ts';
import { TaskNode, TaskPriority } from '../types/index.ts';
import { AgentManager } from '../agents/AgentManager.ts';
import { TaskManager } from '../tasks/TaskManager.ts';
import { EventBus } from '../events/EventBus.ts';
import { generateId } from '../utils/id.ts';
import { TelemetryService } from '../telemetry/TelemetryService.ts';
import { BackpressureEnforcer } from './BackpressureEnforcer.ts';

export interface SchedulerOptions {
  maxConcurrentTasks?: number;
  retryDelayMs?: number;
  stepDelayMs?: number;
  defaultTaskTimeoutMs?: number;
}

export type ErrorClassification =
  | 'transient'
  | 'permanent'
  | 'provider_unavailable'
  | 'validation_error'
  | 'tool_failure'
  | 'timeout';

/**
 * Enterprise DAG Scheduler with:
 * - Backpressure enforcement
 * - Deep cooperative cancellation propagation
 * - Configurable task timeouts
 * - Smart retries with exponential backoff and error classification
 * - Telemetry correlation ID propagation
 */
export class Scheduler {
  public maxConcurrentTasks: number;
  private retryDelayMs: number;
  private stepDelayMs: number;
  private defaultTaskTimeoutMs: number;
  private isRunning: boolean = false;
  private abortController: AbortController | null = null;
  private telemetry: TelemetryService = TelemetryService.getInstance();
  private backpressure: BackpressureEnforcer = BackpressureEnforcer.getInstance();

  constructor(options?: SchedulerOptions) {
    this.maxConcurrentTasks = options?.maxConcurrentTasks ?? 4;
    this.retryDelayMs = options?.retryDelayMs ?? 250;
    this.stepDelayMs = options?.stepDelayMs ?? 150;
    this.defaultTaskTimeoutMs = options?.defaultTaskTimeoutMs ?? 30000;
  }

  /**
   * Classify an execution error to determine retry strategy.
   */
  public static classifyError(errorMsg: string): ErrorClassification {
    const msg = errorMsg.toLowerCase();
    if (msg.includes('timed out') || msg.includes('timeout')) return 'timeout';
    if (msg.includes('permission') || msg.includes('unauthorized') || msg.includes('forbidden') || msg.includes('invalid input') || msg.includes('syntax')) {
      return 'permanent';
    }
    if (msg.includes('unavailable') || msg.includes('connection refused') || msg.includes('offline')) {
      return 'provider_unavailable';
    }
    if (msg.includes('validation')) return 'validation_error';
    if (msg.includes('tool')) return 'tool_failure';
    return 'transient';
  }

  /**
   * Execute a TaskGraph to completion, running independent nodes concurrently.
   */
  public async executeGraph(
    graph: TaskGraph,
    signal?: AbortSignal,
    onProgress?: (graph: TaskGraph) => void
  ): Promise<boolean> {
    const validation = graph.validate();
    if (!validation.valid) {
      graph.status = 'failed';
      graph.error = `Graph validation failed: ${validation.errors.join('; ')}`;
      return false;
    }

    this.isRunning = true;
    this.abortController = new AbortController();
    const abortSignal = signal || this.abortController.signal;

    const activePromises = new Map<string, Promise<void>>();

    return new Promise<boolean>((resolve) => {
      const onAbort = () => {
        graph.cancel();
        this.cleanup();
        resolve(false);
      };

      if (abortSignal.aborted) {
        onAbort();
        return;
      }

      abortSignal.addEventListener('abort', onAbort, { once: true });

      const checkAndDispatch = () => {
        if (abortSignal.aborted || graph.status === 'cancelled') {
          graph.cancel();
          this.cleanup();
          resolve(false);
          return;
        }

        if (graph.isCompleted()) {
          abortSignal.removeEventListener('abort', onAbort);
          this.cleanup();
          resolve(true);
          return;
        }

        if (graph.isFailed()) {
          abortSignal.removeEventListener('abort', onAbort);
          this.cleanup();
          resolve(false);
          return;
        }

        // Get currently ready nodes not currently executing
        const readyNodes = graph.getReadyNodes().filter((n) => !activePromises.has(n.id));

        const availableSlots = this.maxConcurrentTasks - activePromises.size;
        if (availableSlots <= 0 || readyNodes.length === 0) {
          if (activePromises.size === 0 && readyNodes.length === 0) {
            if (abortSignal.aborted) {
              graph.cancel();
              this.cleanup();
              resolve(false);
              return;
            }
            graph.status = 'failed';
            graph.error = 'Execution stalled: No ready nodes and no active tasks.';
            abortSignal.removeEventListener('abort', onAbort);
            this.cleanup();
            resolve(false);
          }
          return;
        }

        const toDispatch = readyNodes.slice(0, availableSlots);

        if (toDispatch.length > 1) {
          EventBus.emit({
            id: generateId('ev_batch'),
            type: 'orchestration.parallel_batch_started',
            timestamp: Date.now(),
            initiativeId: graph.initiativeId,
            batchSize: toDispatch.length,
            nodeIds: toDispatch.map((n) => n.id),
            agentIds: toDispatch.map((n) => n.assignedAgentId || 'unassigned'),
            message: `Executing parallel batch of ${toDispatch.length} tasks: [${toDispatch.map((n) => n.title).join(', ')}]`,
          } as any);
        }

        for (const node of toDispatch) {
          graph.markRunning(node.id);

          const taskPromise = this.executeNode(node, graph, abortSignal)
            .then(() => {
              activePromises.delete(node.id);
              if (onProgress) onProgress(graph);
              checkAndDispatch();
            })
            .catch((err) => {
              activePromises.delete(node.id);
              const errorMsg = err instanceof Error ? err.message : String(err);
              graph.markFailed(node.id, errorMsg);
              if (onProgress) onProgress(graph);
              checkAndDispatch();
            });

          activePromises.set(node.id, taskPromise);
        }
      };

      // Initial dispatch
      checkAndDispatch();
    });
  }

  /**
   * Execute an individual TaskNode via AgentManager with timeouts, retries, and backpressure.
   */
  private async executeNode(node: TaskNode, graph: TaskGraph, signal: AbortSignal): Promise<void> {
    const assignedAgentId = node.assignedAgentId;
    if (!assignedAgentId) {
      throw new Error(`Node "${node.id}" has no assigned agent.`);
    }

    // Check backpressure capacity
    const capacity = this.backpressure.canAcceptTask(assignedAgentId, node.providerId || 'mock', graph.getAllNodes().length);
    if (!capacity.allowed) {
      console.warn(`[Backpressure] ${capacity.reason}. Yielding slot briefly...`);
      await new Promise((r) => setTimeout(r, 100));
    }
    this.backpressure.acquireTaskSlot(assignedAgentId, node.providerId || 'mock');

    // Ensure task model exists in TaskManager
    let task = TaskManager.getById(node.taskId);
    if (!task) {
      task = TaskManager.createTask({
        title: node.title,
        description: node.description || `Autonomous execution node for ${graph.name}`,
        priority: node.priority || 'HIGH',
        assignedAgentId,
      });
      node.taskId = task.id;
    }

    const executionId = generateId('exec');
    const correlation = {
      missionId: graph.initiativeId,
      taskId: node.taskId,
      executionId,
    };

    EventBus.emit({
      id: generateId('ev_node'),
      type: 'orchestration.task_ready',
      timestamp: Date.now(),
      initiativeId: graph.initiativeId,
      nodeId: node.id,
      taskId: node.taskId,
      assignedAgentId,
      correlation,
      message: `Node ready & assigned to ${assignedAgentId.toUpperCase()}: "${node.title}"`,
    } as any);

    const startTime = Date.now();

    try {
      // Execute with timeout and deep abort propagation
      const timeoutMs = this.defaultTaskTimeoutMs;
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timer = setTimeout(() => reject(new Error(`Task timed out after ${timeoutMs}ms`)), timeoutMs);
        signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
      });

      const executePromise = AgentManager.executeTask(assignedAgentId, task, {
        taskId: node.taskId,
        agentId: assignedAgentId,
        abortSignal: signal,
        stepDelayMs: this.stepDelayMs,
        metadata: { correlation },
      });

      const result = await Promise.race([executePromise, timeoutPromise]);
      const durationMs = Date.now() - startTime;

      this.backpressure.releaseTaskSlot(assignedAgentId, node.providerId || 'mock');

      if (result.success) {
        this.telemetry.recordExecution({
          correlation,
          agentId: assignedAgentId,
          providerId: node.providerId || 'mock',
          durationMs,
          success: true,
          isRetry: node.retryCount > 0,
        });

        const unblocked = graph.markCompleted(node.id, result);
        for (const childId of unblocked) {
          const child = graph.getNode(childId);
          if (child) {
            EventBus.emit({
              id: generateId('ev_unblock'),
              type: 'orchestration.task_ready',
              timestamp: Date.now(),
              initiativeId: graph.initiativeId,
              nodeId: child.id,
              taskId: child.taskId,
              assignedAgentId: child.assignedAgentId,
              correlation,
              message: `Unblocked dependent task: "${child.title}"`,
            } as any);
          }
        }
      } else {
        // Evaluate smart retry
        const classification = Scheduler.classifyError(result.error || 'Unknown error');
        const canRetry = classification !== 'permanent' && node.retryCount < node.maxRetries;

        this.telemetry.recordExecution({
          correlation,
          agentId: assignedAgentId,
          providerId: node.providerId || 'mock',
          durationMs,
          success: false,
          isRetry: node.retryCount > 0,
        });

        if (canRetry) {
          node.retryCount += 1;
          // Exponential backoff
          const backoff = this.retryDelayMs * Math.pow(2, node.retryCount - 1);
          console.warn(`Smart Retry: Node "${node.id}" failed (${classification}). Retrying in ${backoff}ms (attempt ${node.retryCount}/${node.maxRetries})...`);
          await new Promise((r) => setTimeout(r, backoff));
          return this.executeNode(node, graph, signal);
        } else {
          const blocked = graph.markFailed(node.id, result.error || 'Task execution unsuccessful');
          for (const blockedId of blocked) {
            EventBus.emit({
              id: generateId('ev_block'),
              type: 'orchestration.task_blocked',
              timestamp: Date.now(),
              initiativeId: graph.initiativeId,
              nodeId: blockedId,
              taskId: blockedId,
              blockedBy: [node.id],
              message: `Task blocked due to failure of upstream node: "${node.title}"`,
            } as any);
          }
        }
      }
    } catch (err: unknown) {
      this.backpressure.releaseTaskSlot(assignedAgentId, node.providerId || 'mock');
      const errorMsg = err instanceof Error ? err.message : String(err);
      const classification = Scheduler.classifyError(errorMsg);

      if (classification !== 'permanent' && node.retryCount < node.maxRetries && !signal.aborted) {
        node.retryCount += 1;
        const backoff = this.retryDelayMs * Math.pow(2, node.retryCount - 1);
        await new Promise((r) => setTimeout(r, backoff));
        return this.executeNode(node, graph, signal);
      } else {
        graph.markFailed(node.id, errorMsg);
      }
    }
  }

  public cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isRunning = false;
  }

  private cleanup(): void {
    this.isRunning = false;
    this.abortController = null;
  }
}
