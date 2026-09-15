import { AgentModel, AgentStatus, Position, TaskModel } from '../types';
import { INITIAL_AGENTS } from '../data/agents';
import { EventBus } from '../events/EventBus';
import {
  AgentProvider,
  AgentRuntime,
  MockAgentProvider,
  TaskExecutionContext,
  TaskExecutionResult,
} from './AgentProvider';
import { ProviderRegistry } from './ProviderRegistry';
import { GeminiProvider } from './providers/GeminiProvider';
import { AntigravityProvider } from './providers/AntigravityProvider';
import {
  RuntimeStartedEvent,
  RuntimeThinkingEvent,
  RuntimeToolStartedEvent,
  RuntimeCompletedEvent,
  RuntimeFailedEvent,
} from '../events/EventTypes';
import { generateId } from '../utils/id';
import { Logger } from '../utils/logger';

class AgentManagerClass {
  private agents: Map<string, AgentModel> = new Map();
  private runtimes: Map<string, AgentRuntime> = new Map();
  private provider: AgentProvider = new MockAgentProvider();
  private activeExecutions: Map<string, Promise<TaskExecutionResult>> = new Map();

  constructor() {
    this.init();
    this.setupRuntimeEventListeners();
  }

  private init(): void {
    const registry = ProviderRegistry.getInstance();
    if (!registry.get('mock')) registry.register(new MockAgentProvider());
    if (!registry.get('gemini')) registry.register(new GeminiProvider());
    if (!registry.get('antigravity')) registry.register(new AntigravityProvider());

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem('agent_hq_agents');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsed.forEach((a: AgentModel) => {
              if (a && typeof a === 'object' && a.id) {
                this.agents.set(a.id, a);
              }
            });
            if (this.agents.size > 0) {
              // Ensure any newly added initial agents (e.g. Quill) are incorporated
              INITIAL_AGENTS.forEach((seed) => {
                if (!this.agents.has(seed.id)) {
                  this.agents.set(seed.id, { ...seed, currentPosition: { ...seed.deskPosition } });
                }
              });
              this.initRuntimes();
              return;
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load agents from localStorage; initializing defaults.', e);
    }

    // Fallback to initial seeds
    INITIAL_AGENTS.forEach((a) => {
      this.agents.set(a.id, { ...a, currentPosition: { ...a.deskPosition } });
    });

    this.initRuntimes();
  }

  private setupRuntimeEventListeners(): void {
    EventBus.on('runtime.started', (ev) => {
      const e = ev as RuntimeStartedEvent;
      const agent = this.agents.get(e.agentId);
      if (agent) {
        agent.status = 'WORKING';
        agent.statusMessage = 'Runtime active';
        this.save();
      }
    });

    EventBus.on('runtime.thinking', (ev) => {
      const e = ev as RuntimeThinkingEvent;
      const agent = this.agents.get(e.agentId);
      if (agent) {
        agent.status = 'THINKING';
        agent.thoughtBubble = e.thought;
        this.save();
      }
    });

    EventBus.on('runtime.tool_started', (ev) => {
      const e = ev as RuntimeToolStartedEvent;
      const agent = this.agents.get(e.agentId);
      if (agent) {
        agent.status = 'TOOL_EXECUTION';
        agent.statusMessage = `Running ${e.tool.name}`;
        this.save();
      }
    });

    EventBus.on('approval.requested' as any, (ev: any) => {
      const req = ev?.request;
      if (req && req.agentId) {
        const agent = this.agents.get(req.agentId);
        if (agent) {
          agent.status = 'WAITING_APPROVAL';
          agent.statusMessage = `Awaiting Human Approval: ${req.toolName}`;
          this.save();
        }
      }
    });

    EventBus.on('runtime.completed', (ev) => {
      const e = ev as RuntimeCompletedEvent;
      const agent = this.agents.get(e.agentId);
      if (agent) {
        agent.status = 'COMPLETED';
        agent.statusMessage = 'Task completed';
        agent.thoughtBubble = undefined;
        agent.currentTaskId = null;
        agent.stats.tasksInProgress = 0;
        this.save();
      }
    });

    EventBus.on('runtime.failed', (ev) => {
      const e = ev as RuntimeFailedEvent;
      const agent = this.agents.get(e.agentId);
      if (agent) {
        agent.status = 'ERROR';
        agent.statusMessage = `Execution error: ${e.error}`;
        agent.stats.tasksInProgress = 0;
        this.save();
      }
    });

    EventBus.on('provider.health_changed', () => {
      this.initRuntimes().catch(() => {});
    });
  }

  private async initRuntimes(): Promise<void> {
    // Terminate existing runtimes
    for (const runtime of this.runtimes.values()) {
      try {
        await runtime.terminate();
      } catch {
        // ignore cleanup error
      }
    }
    this.runtimes.clear();

    // Instantiate new runtimes dynamically resolved per agent from ProviderRegistry
    const registry = ProviderRegistry.getInstance();
    for (const agent of this.agents.values()) {
      try {
        const { provider, isFallback, reason } = registry.resolveProviderForAgent(agent);
        if (isFallback && reason) {
          // Log fallback diagnostic
          console.info(`[AgentManager] ${agent.name}: ${reason}`);
        }
        const runtime = await provider.createRuntime(agent);
        this.runtimes.set(agent.id, runtime);
      } catch (err) {
        console.error(`Failed to initialize runtime for agent ${agent.id}:`, err);
      }
    }
  }

  public async setProvider(provider: AgentProvider): Promise<void> {
    this.provider = provider;
    ProviderRegistry.getInstance().register(provider);
    await this.initRuntimes();
  }

  public getProvider(): AgentProvider {
    return this.provider;
  }

  public getProviderForAgent(agentId: string): AgentProvider {
    const agent = this.agents.get(agentId);
    if (agent) {
      return ProviderRegistry.getInstance().resolveProviderForAgent(agent).provider;
    }
    return this.provider;
  }

  public async setProviderForAgent(agentId: string, providerId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    agent.providerId = providerId;
    this.save();

    const existing = this.runtimes.get(agentId);
    if (existing) {
      await existing.terminate().catch(() => {});
    }

    const { provider } = ProviderRegistry.getInstance().resolveProviderForAgent(agent);
    const runtime = await provider.createRuntime(agent);
    this.runtimes.set(agentId, runtime);
  }

  public getRuntime(agentId: string): AgentRuntime | undefined {
    return this.runtimes.get(agentId);
  }

  public getAll(): AgentModel[] {
    return Array.from(this.agents.values());
  }

  public getById(id: string): AgentModel | undefined {
    return this.agents.get(id);
  }

  /**
   * Dispatches a task to an agent's runtime for asynchronous execution.
   */
  public async executeTask(
    agentId: string,
    task: TaskModel,
    context?: TaskExecutionContext
  ): Promise<TaskExecutionResult> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return {
        taskId: task.id,
        agentId,
        success: false,
        error: `Agent ${agentId} not found`,
      };
    }

    // Resolve provider dynamically based on live health checks & fallbacks
    const resolved = ProviderRegistry.getInstance().resolveProviderForAgent(agent);
    let runtime = this.runtimes.get(agentId);

    if (!runtime || runtime.providerId !== resolved.provider.id) {
      runtime = await resolved.provider.createRuntime(agent);
      this.runtimes.set(agentId, runtime);
      Logger.providerSelected(
        agentId,
        resolved.provider.id,
        resolved.provider.id === 'mock' ? 'mock' : 'real',
        resolved.reason
      );
    }

    agent.currentTaskId = task.id;
    agent.stats.tasksInProgress = 1;
    agent.status = 'WORKING';
    this.save();

    const executionPromise = runtime.executeTask(task, context).then((result) => {
      if (result.success) {
        agent.stats.tasksCompleted += 1;
        agent.stats.tasksInProgress = 0;
        agent.currentTaskId = null;
        agent.status = 'COMPLETED';
        agent.thoughtBubble = undefined;
      } else {
        agent.status = 'ERROR';
        agent.stats.tasksInProgress = 0;
      }
      this.save();
      this.activeExecutions.delete(task.id);
      return result;
    }).catch((err: unknown) => {
      const errorMsg = err instanceof Error ? err.message : String(err);
      agent.status = 'ERROR';
      agent.stats.tasksInProgress = 0;
      this.save();
      this.activeExecutions.delete(task.id);
      return {
        taskId: task.id,
        agentId,
        success: false,
        error: errorMsg,
      };
    });

    this.activeExecutions.set(task.id, executionPromise);
    return executionPromise;
  }

  public setStatus(agentId: string, status: AgentStatus, statusMessage?: string): AgentModel | undefined {
    const agent = this.agents.get(agentId);
    if (!agent) return undefined;

    const previousStatus = agent.status;
    agent.status = status;
    if (statusMessage !== undefined) {
      agent.statusMessage = statusMessage;
    }

    this.save();

    EventBus.emit({
      id: generateId('ev'),
      type: 'agent.state_changed',
      timestamp: Date.now(),
      agentId,
      previousStatus,
      currentStatus: status,
      statusMessage: agent.statusMessage,
      message: `${agent.name} is now ${status}${statusMessage ? ` — ${statusMessage}` : ''}`,
    });

    return agent;
  }

  public setThought(agentId: string, thought: string | undefined): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    agent.thoughtBubble = thought;
  }

  public setSpeech(agentId: string, text: string, durationMs: number = 4000): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    agent.speechBubble = {
      text,
      expiresAt: Date.now() + durationMs,
    };
  }

  public clearSpeech(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    agent.speechBubble = undefined;
  }

  public setPosition(agentId: string, pos: Position, facing?: 'up' | 'down' | 'left' | 'right'): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    agent.currentPosition = { ...pos };
    if (facing) {
      agent.facing = facing;
    }
  }

  public setTargetPosition(agentId: string, target: Position | null): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    agent.targetPosition = target ? { ...target } : null;
    if (target) {
      agent.status = 'WALKING';
    }
  }

  public returnToDesk(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    this.setTargetPosition(agentId, { ...agent.deskPosition });
  }

  public setAgentProvider(agentId: string, providerId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    agent.providerId = providerId;
    this.runtimes.delete(agentId);
    EventBus.emit({
      id: generateId('ev'),
      type: 'agent.state_changed',
      timestamp: Date.now(),
      agentId,
      previousStatus: agent.status,
      currentStatus: agent.status,
      message: `${agent.name} provider updated to [${providerId}]`,
    });
  }

  public incrementStats(agentId: string, key: keyof AgentModel['stats'], amount: number = 1): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    agent.stats[key] += amount;
    this.save();
  }

  public assignTask(agentId: string, taskId: string | null): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    agent.currentTaskId = taskId;
    if (taskId) {
      agent.stats.tasksInProgress = 1;
    } else {
      agent.stats.tasksInProgress = 0;
    }
    this.save();
  }

  public async addAgent(newAgent: AgentModel): Promise<void> {
    this.agents.set(newAgent.id, newAgent);
    try {
      const runtime = await this.provider.createRuntime(newAgent);
      this.runtimes.set(newAgent.id, runtime);
    } catch (err) {
      console.error(`Failed to create runtime for agent ${newAgent.id}:`, err);
    }

    this.save();
    EventBus.emit({
      id: generateId('ev'),
      type: 'agent.created',
      timestamp: Date.now(),
      agentId: newAgent.id,
      role: newAgent.role,
      message: `Agent ${newAgent.name} (${newAgent.role}) joined Agent HQ`,
    });
  }

  public reset(): void {
    this.agents.clear();
    INITIAL_AGENTS.forEach((a) => {
      this.agents.set(a.id, { ...a, currentPosition: { ...a.deskPosition } });
    });
    this.initRuntimes();
    this.save();
  }

  private save(): void {
    try {
      localStorage.setItem('agent_hq_agents', JSON.stringify(Array.from(this.agents.values())));
    } catch {
      // ignore
    }
  }
}

export const AgentManager = new AgentManagerClass();
