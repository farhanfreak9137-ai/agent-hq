export interface BackpressureLimits {
  maxGlobalQueueDepth?: number;
  maxPerAgentConcurrency?: number;
  maxPerProviderConcurrency?: number;
  maxTasksPerMission?: number;
}

export interface CapacityCheckResult {
  allowed: boolean;
  reason?: string;
  statusCode?: 'CAPACITY_EXCEEDED' | 'AGENT_BUSY' | 'PROVIDER_SATURATED';
}

/**
 * BackpressureEnforcer prevents cascade failures under extreme load
 * by enforcing queue limits, per-agent saturation limits, and provider thresholds.
 */
export class BackpressureEnforcer {
  private static instance: BackpressureEnforcer | null = null;

  private limits: Required<BackpressureLimits> = {
    maxGlobalQueueDepth: 100,
    maxPerAgentConcurrency: 2,
    maxPerProviderConcurrency: 6,
    maxTasksPerMission: 120,
  };

  private agentActiveTasks: Map<string, number> = new Map();
  private providerActiveTasks: Map<string, number> = new Map();
  private currentQueueDepth: number = 0;

  private constructor() {}

  public static getInstance(): BackpressureEnforcer {
    if (!BackpressureEnforcer.instance) {
      BackpressureEnforcer.instance = new BackpressureEnforcer();
    }
    return BackpressureEnforcer.instance;
  }

  public setLimits(limits: Partial<BackpressureLimits>): void {
    this.limits = { ...this.limits, ...limits };
  }

  public canAcceptTask(agentId: string, providerId: string = 'mock', currentMissionTaskCount: number = 0): CapacityCheckResult {
    // 1. Mission limits
    if (currentMissionTaskCount >= this.limits.maxTasksPerMission) {
      return {
        allowed: false,
        statusCode: 'CAPACITY_EXCEEDED',
        reason: `Mission task count (${currentMissionTaskCount}) exceeds maximum limit (${this.limits.maxTasksPerMission}).`,
      };
    }

    // 2. Global queue limit
    if (this.currentQueueDepth >= this.limits.maxGlobalQueueDepth) {
      return {
        allowed: false,
        statusCode: 'CAPACITY_EXCEEDED',
        reason: `Global scheduler queue depth (${this.currentQueueDepth}) has reached saturation threshold (${this.limits.maxGlobalQueueDepth}).`,
      };
    }

    // 3. Per-agent concurrency limit
    const agentActive = this.agentActiveTasks.get(agentId) || 0;
    if (agentActive >= this.limits.maxPerAgentConcurrency) {
      return {
        allowed: false,
        statusCode: 'AGENT_BUSY',
        reason: `Agent ${agentId.toUpperCase()} is saturated with ${agentActive} concurrent tasks (limit: ${this.limits.maxPerAgentConcurrency}).`,
      };
    }

    // 4. Per-provider concurrency limit
    const providerActive = this.providerActiveTasks.get(providerId) || 0;
    if (providerActive >= this.limits.maxPerProviderConcurrency) {
      return {
        allowed: false,
        statusCode: 'PROVIDER_SATURATED',
        reason: `Provider ${providerId} is operating at peak capacity (${providerActive}/${this.limits.maxPerProviderConcurrency}).`,
      };
    }

    return { allowed: true };
  }

  public acquireTaskSlot(agentId: string, providerId: string = 'mock'): void {
    this.agentActiveTasks.set(agentId, (this.agentActiveTasks.get(agentId) || 0) + 1);
    this.providerActiveTasks.set(providerId, (this.providerActiveTasks.get(providerId) || 0) + 1);
    this.currentQueueDepth = Math.max(0, this.currentQueueDepth - 1);
  }

  public releaseTaskSlot(agentId: string, providerId: string = 'mock'): void {
    const agentCount = Math.max(0, (this.agentActiveTasks.get(agentId) || 1) - 1);
    this.agentActiveTasks.set(agentId, agentCount);

    const provCount = Math.max(0, (this.providerActiveTasks.get(providerId) || 1) - 1);
    this.providerActiveTasks.set(providerId, provCount);
  }

  public recordQueueEnqueued(): void {
    this.currentQueueDepth++;
  }

  public recordQueueDequeued(): void {
    this.currentQueueDepth = Math.max(0, this.currentQueueDepth - 1);
  }

  public reset(): void {
    this.agentActiveTasks.clear();
    this.providerActiveTasks.clear();
    this.currentQueueDepth = 0;
  }
}
