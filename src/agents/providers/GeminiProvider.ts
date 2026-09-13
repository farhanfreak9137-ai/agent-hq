import { AgentProvider, AgentRuntime, TaskExecutionContext, TaskExecutionResult, MessageResponse, AgentEventStreamItem } from '../AgentProvider';
import { AgentModel, AgentRuntimeStatus, AgentCapability, ProviderCapability, ProviderHealth, TaskModel, MessageModel } from '../../types';
import { AgentMemory, InMemoryAgentMemory } from '../AgentMemory';
import { PersistentAgentMemory } from '../PersistentMemory';
import { ToolExecutor, MockToolExecutor } from '../ToolExecutor';
import { EventBus } from '../../events/EventBus';
import { generateId } from '../../utils/id';
import { Logger } from '../../utils/logger';

/**
 * Gemini Runtime executes tasks via the secure backend bridge
 * ensuring API keys are never exposed in browser bundles.
 */
export class GeminiAgentRuntime implements AgentRuntime {
  public readonly agentId: string;
  public readonly providerId: string = 'gemini';
  public status: AgentRuntimeStatus = 'IDLE';
  public readonly capabilities: AgentCapability[];
  public readonly memory: AgentMemory;
  public readonly tools: ToolExecutor;

  private isTerminated: boolean = false;
  private readonly agentModel: AgentModel;
  private readonly backendUrl: string;

  constructor(agent: AgentModel, tools?: ToolExecutor, memory?: AgentMemory, backendUrl: string = '') {
    this.agentId = agent.id;
    this.agentModel = agent;
    this.capabilities = agent.capabilities ? [...agent.capabilities] : ['coding'];
    this.memory = memory || new PersistentAgentMemory(agent.id);
    this.tools = tools || new MockToolExecutor(150);
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
      message: `${this.agentModel.name} initialized Gemini runtime for task: "${task.title}"`,
    });

    try {
      this.status = 'THINKING';
      EventBus.emit({
        id: generateId('ev'),
        type: 'runtime.thinking',
        timestamp: Date.now(),
        agentId: this.agentId,
        taskId: task.id,
        thought: `Querying Gemini 2.5 architecture engine for "${task.title}"...`,
        message: `${this.agentModel.name} is consulting Gemini model for technical synthesis`,
      });

      // Call secure backend provider bridge
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
          providerId: 'gemini',
        }),
        signal: context?.abortSignal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Gemini backend HTTP ${response.status}`);
      }

      const result = await response.json();
      this.status = 'COMPLETED';
      const durationMs = Date.now() - startTime;
      const executionMode = result.executionMode === 'real' ? 'real' : 'mock';

      const executionResult: TaskExecutionResult = {
        taskId: task.id,
        agentId: this.agentId,
        success: true,
        summary: result.summary || `Gemini completed task "${task.title}"`,
        output: result.output || '',
        durationMs,
        toolsUsed: result.toolsUsed || ['gemini_reasoning'],
        executionMode,
      };

      Logger.taskCompleted(task.id, this.agentId, task.title, 'gemini', executionMode, durationMs);

      this.memory.remember({
        type: 'task_completed',
        content: executionResult.summary || 'Task completed via Gemini',
        metadata: { taskId: task.id, executionMode },
      });

      EventBus.emit({
        id: generateId('ev'),
        type: 'runtime.completed',
        timestamp: Date.now(),
        agentId: this.agentId,
        taskId: task.id,
        result: executionResult,
        message: `${this.agentModel.name} executed task via Gemini [${executionMode.toUpperCase()}].`,
      });

      return executionResult;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.status = 'ERROR';
      Logger.taskFailed(task.id, this.agentId, task.title, errorMsg, 'gemini');

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
        message: `${this.agentModel.name} Gemini task execution failed: ${errorMsg}`,
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
      replyText: `Acknowledged by Gemini runtime (${this.agentModel.name})`,
    };
  }

  public async terminate(): Promise<void> {
    this.isTerminated = true;
    this.status = 'TERMINATED';
  }
}

/**
 * GeminiProvider manages connections to Gemini model via backend server.
 */
export class GeminiProvider implements AgentProvider {
  public readonly id = 'gemini';
  public readonly name = 'Google Gemini Provider';
  public readonly capabilities: ReadonlySet<ProviderCapability> = new Set([
    'task_execution',
    'streaming',
    'structured_output',
    'cancellation',
    'tool_execution',
  ]);

  private backendUrl: string;

  constructor(backendUrl: string = '') {
    this.backendUrl = backendUrl;
  }

  public async initialize(): Promise<void> {
    // Health check will determine availability
  }

  public async healthCheck(): Promise<ProviderHealth> {
    try {
      const res = await fetch(`${this.backendUrl}/api/providers/gemini/health`, {
        method: 'GET',
      });
      if (res.ok) {
        const data = await res.json();
        return {
          status: data.available ? 'available' : 'unavailable',
          message: data.message || (data.available ? 'Connected to Gemini backend' : 'Backend unconfigured'),
          latencyMs: data.latencyMs || 10,
          lastChecked: Date.now(),
        };
      }
    } catch {
      // Backend not running or unreachable
    }

    return {
      status: 'unavailable',
      message: 'Backend server unreachable or GEMINI_API_KEY not set.',
      latencyMs: 0,
      lastChecked: Date.now(),
    };
  }

  public async createRuntime(agent: AgentModel): Promise<AgentRuntime> {
    return new GeminiAgentRuntime(agent, undefined, undefined, this.backendUrl);
  }

  public async shutdown(): Promise<void> {
    // Clean up connections if any
  }
}
