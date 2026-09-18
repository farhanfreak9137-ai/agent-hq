import { AgentProvider, AgentRuntime, TaskExecutionContext, TaskExecutionResult, MessageResponse } from '../AgentProvider';
import { AgentModel, AgentRuntimeStatus, AgentCapability, ProviderCapability, ProviderHealth, TaskModel, MessageModel } from '../../types';
import { AgentMemory, InMemoryAgentMemory } from '../AgentMemory';
import { PersistentAgentMemory } from '../PersistentMemory';
import { ToolExecutor, MockToolExecutor } from '../ToolExecutor';
import { EventBus } from '../../events/EventBus';
import { generateId } from '../../utils/id';
import { Logger } from '../../utils/logger';

/**
 * AntigravityAgentRuntime executes agent tasks via the secure backend
 * Antigravity CLI provider bridge, connecting directly to the user's
 * authorized Google Antigravity session.
 */
export class AntigravityAgentRuntime implements AgentRuntime {
  public readonly agentId: string;
  public readonly providerId: string = 'antigravity';
  public status: AgentRuntimeStatus = 'IDLE';
  public readonly capabilities: AgentCapability[];
  public readonly memory: AgentMemory;
  public readonly tools: ToolExecutor;

  private isTerminated: boolean = false;
  private readonly agentModel: AgentModel;
  private readonly isAvailable: boolean;
  private readonly backendUrl: string;

  constructor(
    agent: AgentModel,
    tools?: ToolExecutor,
    memory?: AgentMemory,
    isAvailable: boolean = false,
    backendUrl: string = ''
  ) {
    this.agentId = agent.id;
    this.agentModel = agent;
    this.capabilities = agent.capabilities ? [...agent.capabilities] : ['orchestration'];
    this.memory = memory || new PersistentAgentMemory(agent.id);
    this.tools = tools || new MockToolExecutor(200);
    this.isAvailable = isAvailable;
    this.backendUrl = backendUrl;
  }

  public async executeTask(task: TaskModel, context?: TaskExecutionContext): Promise<TaskExecutionResult> {
    const startTime = Date.now();
    this.status = 'STARTING';

    EventBus.emit({
      id: generateId('ev'),
      type: 'runtime.started',
      timestamp: startTime,
      agentId: this.agentId,
      taskId: task.id,
      status: 'STARTING',
      message: `${this.agentModel.name} initialized Antigravity execution for "${task.title}"`,
    });

    if (!this.isAvailable) {
      const errorMsg = 'Official Google Antigravity CLI (agy) not detected or unauthenticated. Configure Antigravity CLI or use Mock fallback.';
      this.status = 'ERROR';
      EventBus.emit({
        id: generateId('ev'),
        type: 'runtime.failed',
        timestamp: Date.now(),
        agentId: this.agentId,
        taskId: task.id,
        error: errorMsg,
        message: `[Antigravity Provider] Execution rejected: ${errorMsg}`,
      });

      return {
        taskId: task.id,
        agentId: this.agentId,
        success: false,
        error: errorMsg,
        durationMs: Date.now() - startTime,
        executionMode: 'mock',
      };
    }

    try {
      this.status = 'THINKING';
      EventBus.emit({
        id: generateId('ev'),
        type: 'runtime.thinking',
        timestamp: Date.now(),
        agentId: this.agentId,
        taskId: task.id,
        thought: `Executing via official Google Antigravity account for "${task.title}"...`,
        message: `${this.agentModel.name} is consulting Google Antigravity for technical execution`,
      });

      const response = await fetch(`${this.backendUrl}/api/tasks/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task.id,
          agentId: this.agentId,
          agentName: this.agentModel.name,
          role: this.agentModel.role,
          title: task.title,
          description: task.description,
          capabilities: this.capabilities,
          providerId: 'antigravity',
        }),
        signal: context?.abortSignal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Antigravity backend HTTP ${response.status}`);
      }

      const result = await response.json();
      this.status = 'COMPLETED';
      const durationMs = Date.now() - startTime;
      const executionMode = result.executionMode === 'real' ? 'real' : 'mock';

      const executionResult: TaskExecutionResult = {
        taskId: task.id,
        agentId: this.agentId,
        success: true,
        summary: result.summary || `Antigravity completed task "${task.title}"`,
        output: result.output || '',
        durationMs,
        toolsUsed: result.toolsUsed || ['antigravity_reasoning'],
        executionMode,
        filesCreated: result.filesCreated,
      };

      Logger.taskCompleted(task.id, this.agentId, task.title, 'antigravity', executionMode, durationMs);

      this.memory.remember({
        type: 'task_completed',
        content: executionResult.summary || 'Task completed via Antigravity',
        metadata: { taskId: task.id, executionMode, conversationId: result.conversationId },
      });

      EventBus.emit({
        id: generateId('ev'),
        type: 'runtime.completed',
        timestamp: Date.now(),
        agentId: this.agentId,
        taskId: task.id,
        result: executionResult,
        message: `${this.agentModel.name} executed task via Google Antigravity [${executionMode.toUpperCase()}].`,
      });

      EventBus.emit({
        id: generateId('ev'),
        type: 'task.completed',
        timestamp: Date.now(),
        taskId: task.id,
        agentId: this.agentId,
        result: executionResult,
        message: `Task "${task.title}" completed successfully by ${this.agentModel.name}`,
      });

      return executionResult;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.status = 'ERROR';
      Logger.taskFailed(task.id, this.agentId, task.title, errorMsg, 'antigravity');

      const failureResult: TaskExecutionResult = {
        taskId: task.id,
        agentId: this.agentId,
        success: false,
        error: errorMsg,
        durationMs: Date.now() - startTime,
      };

      EventBus.emit({
        id: generateId('ev'),
        type: 'runtime.failed',
        timestamp: Date.now(),
        agentId: this.agentId,
        taskId: task.id,
        error: errorMsg,
        message: `${this.agentModel.name} Antigravity task execution failed: ${errorMsg}`,
      });

      return failureResult;
    }
  }

  public async handleMessage(message: MessageModel): Promise<MessageResponse> {
    if (this.isTerminated) return { accepted: false };
    this.memory.remember({
      type: 'message_received',
      content: `${message.fromAgentId}: "${message.content}"`,
    });
    return {
      accepted: true,
      replyText: `[Antigravity Adapter] Message routed to ${this.agentModel.name}`,
    };
  }

  public async terminate(): Promise<void> {
    this.isTerminated = true;
    this.status = 'TERMINATED';
  }
}

/**
 * AntigravityProvider establishes a clean integration boundary
 * around the official Google Antigravity CLI and authorized account session.
 * It strictly refuses to extract user credentials or store keys in .env.
 */
export class AntigravityProvider implements AgentProvider {
  public readonly id = 'antigravity';
  public readonly name = 'Google Antigravity Provider';
  public readonly capabilities: ReadonlySet<ProviderCapability> = new Set([
    'task_execution',
    'subagents',
    'tool_execution',
    'cancellation',
    'memory',
  ]);

  private isAvailable: boolean = false;
  private backendUrl: string;
  private activeModel: string = 'gemini-3.8-flash-low';

  constructor(backendUrl?: string) {
    if (backendUrl !== undefined) {
      this.backendUrl = backendUrl;
    } else if (typeof window === 'undefined') {
      this.backendUrl = 'http://127.0.0.1:3001';
    } else {
      this.backendUrl = '';
    }
  }

  public async initialize(): Promise<void> {
    await this.healthCheck();
  }

  public async healthCheck(): Promise<ProviderHealth> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${this.backendUrl}/api/providers/antigravity/health`, {
        signal: controller.signal,
      }).catch(() => null);
      clearTimeout(timeout);

      if (res && res.ok) {
        const data = await res.json();
        this.isAvailable = Boolean(data.available);
        if (data.model) {
          this.activeModel = data.model;
        }
        return {
          status: this.isAvailable ? 'available' : 'unavailable',
          message: data.message || 'Antigravity CLI operational',
          latencyMs: data.latencyMs || 8,
          lastChecked: Date.now(),
        };
      }
    } catch {
      // ignore
    }

    this.isAvailable = false;
    return {
      status: 'unavailable',
      message: 'Official Antigravity CLI / backend bridge unreachable. Safe fallback to Mock provider enabled.',
      latencyMs: 0,
      lastChecked: Date.now(),
    };
  }

  public async createRuntime(agent: AgentModel): Promise<AgentRuntime> {
    return new AntigravityAgentRuntime(agent, undefined, undefined, this.isAvailable, this.backendUrl);
  }

  public async shutdown(): Promise<void> {
    this.isAvailable = false;
  }
}
