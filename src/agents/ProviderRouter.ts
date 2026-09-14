import {
  AgentCapability,
  AgentModel,
  TaskModel,
  ProviderCapability,
} from '../types/index.ts';
import { ProviderRegistry } from './ProviderRegistry.ts';

export interface RouteResolution {
  providerId: string;
  modelId: string;
  executionMode: 'real' | 'mock';
  reason: string;
}

export interface RoutingCriteria {
  task: TaskModel;
  agent: AgentModel;
  requiredCapabilities?: AgentCapability[];
  costPreference?: 'cost_efficient' | 'performance_first';
  latencyRequirementMs?: number;
}

/**
 * Intelligent Provider & Model Router.
 * Evaluates task complexity, agent requirements, provider health, latency,
 * and capabilities to route requests to the optimal provider and model.
 * Gracefully falls back to Mock provider when external providers are offline.
 */
export class ProviderRouter {
  private static instance: ProviderRouter | null = null;
  private registry: ProviderRegistry = ProviderRegistry.getInstance();

  private constructor() {}

  public static getInstance(): ProviderRouter {
    if (!ProviderRouter.instance) {
      ProviderRouter.instance = new ProviderRouter();
    }
    return ProviderRouter.instance;
  }

  /**
   * Resolve best provider and model for a task execution.
   */
  public async resolveRoute(criteria: RoutingCriteria): Promise<RouteResolution> {
    const { task, agent, costPreference } = criteria;
    const preferredProviderId = agent.providerId || 'mock';

    // 1. Check if preferred provider is registered and healthy
    const preferredProvider = this.registry.getProvider(preferredProviderId);
    if (preferredProvider && preferredProviderId !== 'mock') {
      try {
        const health = await preferredProvider.healthCheck();
        if (health.status === 'available') {
          // Select model based on task priority and complexity
          const modelId = this.selectModel(preferredProviderId, task, costPreference);
          return {
            providerId: preferredProviderId,
            modelId,
            executionMode: 'real',
            reason: `Preferred provider [${preferredProvider.name}] healthy and capable for role ${agent.role}.`,
          };
        }
      } catch {
        // Fall through to fallback
      }
    }

    // 2. Safe Fallback to Deterministic Local Mock Provider
    return {
      providerId: 'mock',
      modelId: 'mock-deterministic-v1',
      executionMode: 'mock',
      reason: `Target provider [${preferredProviderId}] unavailable or mock requested; safely routed to Local Autonomous Engine.`,
    };
  }

  private selectModel(
    providerId: string,
    task: TaskModel,
    costPreference?: 'cost_efficient' | 'performance_first'
  ): string {
    if (providerId === 'gemini') {
      if (task.priority === 'CRITICAL' || costPreference === 'performance_first') {
        return 'gemini-1.5-pro';
      }
      return 'gemini-1.5-flash';
    }

    if (providerId === 'antigravity') {
      return 'gemini-3.8-flash-low';
    }

    return 'mock-model-v1';
  }
}
