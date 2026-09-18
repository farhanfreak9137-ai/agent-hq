import {
  AgentModel,
  AgentStatus,
  MessageModel,
  TaskModel,
  TaskLogEntry,
  AgentCapability,
  AgentRuntimeStatus,
  AgentTool,
  ProviderCapability,
  ProviderHealth,
  Artifact,
  ArtifactType,
} from '../types';
import { generateId } from '../utils/id';
import { EventBus } from '../events/EventBus';
import { AgentMemory, InMemoryAgentMemory } from './AgentMemory';
import { PersistentAgentMemory } from './PersistentMemory';
import { LayeredMemory } from '../memory/LayeredMemory';
import { AgentContextBuilder } from './AgentContext';
import { ArtifactManager } from '../artifacts/ArtifactManager';
import { ToolExecutor, MockToolExecutor, BUILTIN_SIMULATED_TOOLS } from './ToolExecutor';
import { Logger } from '../utils/logger';

export interface TaskExecutionContext {
  taskId: string;
  agentId: string;
  abortSignal?: AbortSignal;
  metadata?: Record<string, unknown>;
  stepDelayMs?: number;
}

export interface TaskExecutionResult {
  taskId: string;
  agentId: string;
  success: boolean;
  summary?: string;
  output?: string;
  durationMs?: number;
  toolsUsed?: string[];
  logs?: TaskLogEntry[];
  error?: string;
  executionMode?: 'real' | 'mock';
  confidence?: number;
  artifacts?: Artifact[];
  filesCreated?: Array<{ filename: string; relativePath: string; sizeBytes: number; extension: string; downloadUrl: string }>;
}

export interface MessageResponse {
  replyText?: string;
  accepted: boolean;
}

export interface AgentEventStreamItem {
  timestamp: number;
  type: 'thought' | 'speech' | 'status_change' | 'tool_call' | 'tool_result';
  payload: unknown;
}

export interface AgentActionResponse {
  success: boolean;
  message?: string;
  data?: unknown;
}

/**
 * Individual Agent Runtime interface.
 * Manages task processing, tool execution, memory, and message handling for an agent.
 */
export interface AgentRuntime {
  readonly agentId: string;
  readonly providerId: string;
  readonly status: AgentRuntimeStatus;
  readonly capabilities: AgentCapability[];
  readonly memory: AgentMemory;
  readonly tools: ToolExecutor;
  executeTask(task: TaskModel, context?: TaskExecutionContext): Promise<TaskExecutionResult>;
  handleMessage(message: MessageModel): Promise<MessageResponse>;
  streamEvents?(): AsyncIterable<AgentEventStreamItem>;
  terminate(): Promise<void>;
}

/**
 * Pluggable Agent Provider interface.
 * Decouples the domain layer from external model providers or backends.
 */
export interface AgentProvider {
  readonly id: string;
  readonly name: string;
  readonly capabilities: ReadonlySet<ProviderCapability>;
  initialize(): Promise<void>;
  healthCheck(): Promise<ProviderHealth>;
  createRuntime(agent: AgentModel): Promise<AgentRuntime>;
  shutdown(): Promise<void>;

  // Legacy compatibility helpers
  startTask?(agent: AgentModel, task: TaskModel): Promise<AgentActionResponse>;
  stopTask?(agent: AgentModel): Promise<AgentActionResponse>;
  sendMessage?(fromAgent: AgentModel, toAgent: AgentModel, content: string): Promise<MessageModel>;
  requestDecision?(agent: AgentModel, context: string): Promise<string>;
  getStatus?(agentId: string): Promise<AgentStatus>;
}

/**
 * Default MockAgentRuntime for local deterministic simulation.
 * Emits lifecycle events through EventBus and tracks execution state in memory.
 */
export class MockAgentRuntime implements AgentRuntime {
  public readonly agentId: string;
  public readonly providerId: string = 'mock';
  public status: AgentRuntimeStatus = 'IDLE';
  public readonly capabilities: AgentCapability[];
  public readonly memory: AgentMemory;
  public readonly tools: ToolExecutor;

  private isTerminated: boolean = false;
  private currentAbortController: AbortController | null = null;
  private readonly agentModel: AgentModel;

  constructor(agent: AgentModel, tools?: ToolExecutor, memory?: AgentMemory) {
    this.agentId = agent.id;
    this.agentModel = agent;
    this.capabilities = agent.capabilities && agent.capabilities.length > 0
      ? [...agent.capabilities]
      : [this.getDefaultCapabilityForRole(agent.role)];
    this.memory = memory || new LayeredMemory({ agentId: agent.id, agentRole: agent.role });
    this.tools = tools || new MockToolExecutor(200);
  }

  private getDefaultCapabilityForRole(role: string): AgentCapability {
    switch (role) {
      case 'Coder':
        return 'coding';
      case 'Researcher':
        return 'research';
      case 'Designer':
        return 'design';
      case 'Reviewer':
        return 'review';
      case 'Tester':
        return 'testing';
      case 'Security Engineer':
        return 'security';
      case 'Writer':
        return 'writing';
      case 'Orchestrator':
      default:
        return 'orchestration';
    }
  }

  public async executeTask(task: TaskModel, context?: TaskExecutionContext): Promise<TaskExecutionResult> {
    if (this.isTerminated) {
      return {
        taskId: task.id,
        agentId: this.agentId,
        success: false,
        error: `Agent runtime ${this.agentId} is terminated`,
      };
    }

    const startTime = Date.now();
    const delayMs = context?.stepDelayMs !== undefined ? context.stepDelayMs : 250;
    const signal = context?.abortSignal;

    const checkAborted = (): boolean => {
      return Boolean(signal && signal.aborted);
    };

    const sleep = (ms: number) => {
      return new Promise<void>((resolve, reject) => {
        if (checkAborted()) {
          reject(new Error('Task execution aborted'));
          return;
        }
        const timer = setTimeout(resolve, ms);
        signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('Task execution aborted'));
        });
      });
    };

    const toolsUsed: string[] = [];
    const executionLogs: TaskLogEntry[] = [];

    try {
      // 1. STARTING
      this.status = 'STARTING';
      Logger.taskStarted(task.id, this.agentId, task.title, 'mock', 'mock');
      EventBus.emit({
        id: generateId('ev'),
        type: 'runtime.started',
        timestamp: startTime,
        agentId: this.agentId,
        taskId: task.id,
        status: 'STARTING',
        message: `${this.agentModel.name} started task: "${task.title}"`,
      });

      EventBus.emit({
        id: generateId('ev'),
        type: 'task.started',
        timestamp: Date.now(),
        taskId: task.id,
        agentId: this.agentId,
        message: `Task "${task.title}" execution started by ${this.agentModel.name}`,
      });

      this.memory.remember({
        type: 'task_started',
        content: `Started task: "${task.title}"`,
        metadata: { taskId: task.id, priority: task.priority },
      });

      await sleep(delayMs);

      // 2. WORKING / THINKING
      this.status = 'THINKING';
      const sampleThought = this.generateThoughtForTask(task);
      EventBus.emit({
        id: generateId('ev'),
        type: 'runtime.thinking',
        timestamp: Date.now(),
        agentId: this.agentId,
        taskId: task.id,
        thought: sampleThought,
        message: `${this.agentModel.name} is formulating approach: "${sampleThought}"`,
      });

      EventBus.emit({
        id: generateId('ev'),
        type: 'runtime.progress',
        timestamp: Date.now(),
        agentId: this.agentId,
        taskId: task.id,
        progress: 25,
        statusMessage: sampleThought,
        message: `${this.agentModel.name} analyzed constraints (25% complete)`,
      });

      EventBus.emit({
        id: generateId('ev'),
        type: 'task.progress',
        timestamp: Date.now(),
        taskId: task.id,
        agentId: this.agentId,
        progress: 25,
        status: 'IN_PROGRESS',
        message: `Task "${task.title}" analysis completed (25%)`,
      });

      await sleep(delayMs);

      // 3. TOOL EXECUTION
      this.status = 'TOOL_EXECUTION';
      const selectedTool = this.selectToolForTask(task);
      toolsUsed.push(selectedTool.name);

      EventBus.emit({
        id: generateId('ev'),
        type: 'runtime.tool_started',
        timestamp: Date.now(),
        agentId: this.agentId,
        taskId: task.id,
        tool: selectedTool,
        message: `${this.agentModel.name} executing tool: [${selectedTool.name}]`,
      });

      const toolResult = await this.tools.execute(selectedTool, {
        input: { taskId: task.id, title: task.title },
        agentCapabilities: this.capabilities,
        agentId: this.agentId,
        taskId: task.id,
      });

      EventBus.emit({
        id: generateId('ev'),
        type: 'runtime.tool_completed',
        timestamp: Date.now(),
        agentId: this.agentId,
        taskId: task.id,
        result: toolResult,
        message: `${this.agentModel.name} completed [${selectedTool.name}]: ${toolResult.output}`,
      });

      this.memory.remember({
        type: 'tool_used',
        content: `Executed tool: ${selectedTool.name}`,
        metadata: { toolId: selectedTool.id, output: toolResult.output },
      });

      const toolLog: TaskLogEntry = {
        id: generateId('log'),
        timestamp: Date.now(),
        agentId: this.agentId,
        message: `[${selectedTool.name}] ${toolResult.output}`,
        type: this.getLogTypeForCapability(selectedTool.capability),
      };
      executionLogs.push(toolLog);

      EventBus.emit({
        id: generateId('ev'),
        type: 'runtime.progress',
        timestamp: Date.now(),
        agentId: this.agentId,
        taskId: task.id,
        progress: 75,
        statusMessage: `Applied ${selectedTool.name}`,
        message: `${this.agentModel.name} integrated tool deliverables (75% complete)`,
      });

      EventBus.emit({
        id: generateId('ev'),
        type: 'task.progress',
        timestamp: Date.now(),
        taskId: task.id,
        agentId: this.agentId,
        progress: 75,
        status: 'IN_PROGRESS',
        message: `Task "${task.title}" deliverables compiled (75%)`,
      });

      await sleep(delayMs);

      // 4. FINAL COMPLETION & ARTIFACT SYNTHESIS
      this.status = 'COMPLETED';
      const durationMs = Date.now() - startTime;
      const summary = `Successfully completed "${task.title}" using ${selectedTool.name}`;

      // Create verifiable deliverable artifact
      const artifactType: ArtifactType = selectedTool.capability === 'coding' ? 'code'
        : selectedTool.capability === 'security' ? 'security_report'
        : selectedTool.capability === 'testing' ? 'test_report'
        : selectedTool.capability === 'review' ? 'analysis'
        : selectedTool.capability === 'design' ? 'design'
        : 'research_note';

      const artifact = ArtifactManager.getInstance().createArtifact({
        taskId: task.id,
        agentId: this.agentId,
        type: artifactType,
        title: `${task.title} Deliverable`,
        content: `# Deliverable: ${task.title}\n\n- Executed By: ${this.agentModel.name} (${this.agentModel.role})\n- Tool Used: ${selectedTool.name}\n- Result Output: ${toolResult.output}\n- Verification: All invariants satisfied with zero memory leaks.`,
      });

      const finalResult: TaskExecutionResult = {
        taskId: task.id,
        agentId: this.agentId,
        success: true,
        summary,
        output: toolResult.output,
        durationMs,
        toolsUsed,
        logs: executionLogs,
        executionMode: 'mock',
        confidence: 0.96,
        artifacts: [artifact],
      };

      Logger.taskCompleted(task.id, this.agentId, task.title, 'mock', 'mock', durationMs);

      this.memory.remember({
        type: 'task_completed',
        content: summary,
        metadata: { taskId: task.id, durationMs, toolsUsed },
      });

      EventBus.emit({
        id: generateId('ev'),
        type: 'runtime.completed',
        timestamp: Date.now(),
        agentId: this.agentId,
        taskId: task.id,
        result: finalResult,
        message: `${this.agentModel.name} successfully finalized task: "${task.title}"`,
      });

      EventBus.emit({
        id: generateId('ev'),
        type: 'task.completed',
        timestamp: Date.now(),
        taskId: task.id,
        agentId: this.agentId,
        result: finalResult,
        message: `Task "${task.title}" completed successfully by ${this.agentModel.name}`,
      });

      return finalResult;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.status = 'ERROR';

      const failureResult: TaskExecutionResult = {
        taskId: task.id,
        agentId: this.agentId,
        success: false,
        error: errorMsg,
        durationMs: Date.now() - startTime,
        toolsUsed,
      };

      EventBus.emit({
        id: generateId('ev'),
        type: 'runtime.failed',
        timestamp: Date.now(),
        agentId: this.agentId,
        taskId: task.id,
        error: errorMsg,
        message: `${this.agentModel.name} task execution halted: ${errorMsg}`,
      });

      EventBus.emit({
        id: generateId('ev'),
        type: 'task.failed',
        timestamp: Date.now(),
        taskId: task.id,
        agentId: this.agentId,
        error: errorMsg,
        message: `Task "${task.title}" failed: ${errorMsg}`,
      });

      return failureResult;
    }
  }

  public async handleMessage(message: MessageModel): Promise<MessageResponse> {
    if (this.isTerminated) {
      return { accepted: false };
    }

    const previousStatus = this.status;
    this.status = 'COMMUNICATING';

    this.memory.remember({
      type: 'message_received',
      content: `${message.fromAgentId.toUpperCase()}: "${message.content}"`,
      metadata: { from: message.fromAgentId, type: message.type },
    });

    EventBus.emit({
      id: generateId('ev'),
      type: 'agent.message_received',
      timestamp: Date.now(),
      messageData: message,
      sourceAgentId: message.fromAgentId,
      targetAgentId: this.agentId,
      content: message.content,
      message: `${this.agentModel.name} received message from ${message.fromAgentId.toUpperCase()}`,
    });

    const replyText = this.generateMessageReply(message);

    this.memory.remember({
      type: 'message_sent',
      content: `Replied to ${message.fromAgentId.toUpperCase()}: "${replyText}"`,
      metadata: { to: message.fromAgentId },
    });

    // Restore previous status
    this.status = previousStatus === 'ERROR' ? 'ERROR' : 'IDLE';

    return {
      accepted: true,
      replyText,
    };
  }

  private selectToolForTask(task: TaskModel): AgentTool {
    const primaryCap = this.capabilities[0] || 'coding';
    const matching = this.tools.listTools(primaryCap);
    if (matching.length > 0) {
      return matching[0];
    }
    return BUILTIN_SIMULATED_TOOLS[0];
  }

  private generateThoughtForTask(task: TaskModel): string {
    switch (this.capabilities[0]) {
      case 'coding':
        return `Drafting TypeScript interfaces and asynchronous pipelines for "${task.title.substring(0, 24)}"`;
      case 'research':
        return `Querying vector benchmarks and analyzing latency profiles for "${task.title.substring(0, 24)}"`;
      case 'security':
        return `Verifying cryptographic specifications and boundary guards for "${task.title.substring(0, 24)}"`;
      case 'review':
        return `Conducting rigorous AST inspection and invariant checking on "${task.title.substring(0, 24)}"`;
      case 'testing':
        return `Synthesizing chaos test vectors and fuzz regression parameters for "${task.title.substring(0, 24)}"`;
      case 'design':
        return `Evaluating typography harmony and responsive spatial layout for "${task.title.substring(0, 24)}"`;
      case 'orchestration':
      default:
        return `Deconstructing objective and structuring parallel task graph for "${task.title.substring(0, 24)}"`;
    }
  }

  private generateMessageReply(message: MessageModel): string {
    switch (message.type) {
      case 'task_handover':
        return `Acknowledged task handover. Integrating deliverables into pipeline.`;
      case 'code_review':
        return `PR diff received. Initiating static code analysis and lint verification.`;
      case 'test_report':
        return `Test vectors received. Reviewing regression bounds and coverage.`;
      case 'security_alert':
        return `Security notice received. Enforcing zero-trust mitigation barriers.`;
      default:
        return `Acknowledged: "${message.content.substring(0, 28)}..."`;
    }
  }

  private getLogTypeForCapability(cap: AgentCapability): TaskLogEntry['type'] {
    switch (cap) {
      case 'coding':
        return 'code';
      case 'testing':
        return 'test';
      case 'review':
        return 'review';
      case 'security':
        return 'security';
      default:
        return 'info';
    }
  }

  public async terminate(): Promise<void> {
    this.isTerminated = true;
    this.status = 'TERMINATED';
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
  }
}

/**
 * Default MockAgentProvider for local deterministic simulation.
 */
export class MockAgentProvider implements AgentProvider {
  public readonly id = 'mock';
  public readonly name = 'Local Autonomous Engine';
  public readonly capabilities: ReadonlySet<ProviderCapability> = new Set([
    'task_execution',
    'streaming',
    'tool_execution',
    'memory',
    'messaging',
    'subagents',
    'cancellation',
    'structured_output',
  ]);

  public async initialize(): Promise<void> {
    // No-op for local mock provider
  }

  public async healthCheck(): Promise<ProviderHealth> {
    return {
      status: 'available',
      message: 'Deterministic local mock provider active and operational.',
      latencyMs: 1,
      lastChecked: Date.now(),
    };
  }

  public async createRuntime(agent: AgentModel): Promise<AgentRuntime> {
    return new MockAgentRuntime(agent);
  }

  public async shutdown(): Promise<void> {
    // No-op for local mock provider
  }

  // Legacy compatibility implementations
  public async startTask(agent: AgentModel, task: TaskModel): Promise<AgentActionResponse> {
    return {
      success: true,
      message: `${agent.name} accepted task: "${task.title}"`,
      data: { taskId: task.id, estimatedSeconds: 15 },
    };
  }

  public async stopTask(agent: AgentModel): Promise<AgentActionResponse> {
    return {
      success: true,
      message: `${agent.name} paused task`,
    };
  }

  public async sendMessage(
    fromAgent: AgentModel,
    toAgent: AgentModel,
    content: string
  ): Promise<MessageModel> {
    return {
      id: generateId('msg'),
      fromAgentId: fromAgent.id,
      toAgentId: toAgent.id,
      content,
      timestamp: Date.now(),
      type: 'general',
      read: false,
    };
  }

  public async requestDecision(agent: AgentModel, context: string): Promise<string> {
    return `Synthesized tactical response based on context: ${context.substring(0, 30)}...`;
  }

  public async getStatus(agentId: string): Promise<AgentStatus> {
    return 'WORKING';
  }
}
