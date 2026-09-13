import { AgentProvider } from './AgentProvider';
import { AgentModel, ProviderHealth } from '../types';
import { EventBus } from '../events/EventBus';
import { generateId } from '../utils/id';

/**
 * ProviderRegistry manages available agent execution providers,
 * evaluates health checks, and resolves providers for agents with safe fallback.
 */
export class ProviderRegistry {
  private static instance: ProviderRegistry | null = null;
  private providers: Map<string, AgentProvider> = new Map();
  private healthCache: Map<string, ProviderHealth> = new Map();
  private fallbackProviderId: string = 'mock';

  private constructor() {}

  public static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  /**
   * Register a new agent provider.
   */
  public register(provider: AgentProvider): void {
    this.providers.set(provider.id, provider);
    EventBus.emit({
      id: generateId('ev'),
      type: 'provider.registered',
      timestamp: Date.now(),
      providerId: provider.id,
      providerName: provider.name,
      message: `Provider [${provider.name}] (${provider.id}) registered in Agent HQ.`,
    });
  }

  /**
   * Get provider by ID.
   */
  public get(providerId: string): AgentProvider | undefined {
    return this.providers.get(providerId);
  }

  public getProvider(providerId: string): AgentProvider | undefined {
    return this.get(providerId);
  }

  /**
   * List all registered providers.
   */
  public list(): AgentProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Initialize all registered providers.
   */
  public async initializeAll(): Promise<void> {
    for (const provider of this.providers.values()) {
      try {
        await provider.initialize();
      } catch (err) {
        console.error(`Failed to initialize provider ${provider.id}:`, err);
      }
    }
    await this.healthCheckAll();
  }

  /**
   * Shutdown all registered providers.
   */
  public async shutdownAll(): Promise<void> {
    for (const provider of this.providers.values()) {
      try {
        await provider.shutdown();
      } catch (err) {
        console.error(`Failed to cleanly shutdown provider ${provider.id}:`, err);
      }
    }
  }

  /**
   * Check health of all providers and emit updates if status changed.
   */
  public async healthCheckAll(): Promise<Map<string, ProviderHealth>> {
    const results = new Map<string, ProviderHealth>();

    for (const provider of this.providers.values()) {
      try {
        const health = await provider.healthCheck();
        results.set(provider.id, health);

        const previous = this.healthCache.get(provider.id);
        if (!previous || previous.status !== health.status) {
          this.healthCache.set(provider.id, health);
          EventBus.emit({
            id: generateId('ev'),
            type: 'provider.health_changed',
            timestamp: Date.now(),
            providerId: provider.id,
            health,
            message: `Provider [${provider.name}] health status: ${health.status.toUpperCase()}${health.message ? ` (${health.message})` : ''}`,
          });
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const errorHealth: ProviderHealth = {
          status: 'error',
          message: errorMsg,
          lastChecked: Date.now(),
        };
        results.set(provider.id, errorHealth);
        this.healthCache.set(provider.id, errorHealth);
      }
    }

    return results;
  }

  /**
   * Get cached health for a provider.
   */
  public getHealth(providerId: string): ProviderHealth | undefined {
    return this.healthCache.get(providerId);
  }

  public async checkHealth(providerId: string): Promise<ProviderHealth | undefined> {
    const provider = this.providers.get(providerId);
    if (!provider) return undefined;
    const health = await provider.healthCheck();
    this.healthCache.set(providerId, health);
    return health;
  }

  /**
   * Resolves the appropriate provider for an agent.
   * If the requested provider is unavailable or not registered,
   * falls back to the configured fallback provider (default: 'mock').
   */
  public resolveProviderForAgent(agent: AgentModel): {
    provider: AgentProvider;
    isFallback: boolean;
    reason?: string;
  } {
    const targetProviderId = agent.providerId || this.fallbackProviderId;
    const provider = this.providers.get(targetProviderId);

    if (!provider) {
      const fallback = this.providers.get(this.fallbackProviderId);
      if (!fallback) {
        throw new Error(`Neither target provider [${targetProviderId}] nor fallback provider [${this.fallbackProviderId}] are registered.`);
      }
      return {
        provider: fallback,
        isFallback: true,
        reason: `Target provider [${targetProviderId}] not registered; falling back to [${fallback.name}].`,
      };
    }

    const health = this.healthCache.get(targetProviderId);
    if (health && health.status !== 'available' && targetProviderId !== this.fallbackProviderId) {
      const fallback = this.providers.get(this.fallbackProviderId);
      if (fallback) {
        return {
          provider: fallback,
          isFallback: true,
          reason: `Target provider [${targetProviderId}] is ${health.status} (${health.message || 'Health check failed'}); falling back to [${fallback.name}].`,
        };
      }
    }

    return {
      provider,
      isFallback: false,
    };
  }

  /**
   * Reset registry for testing.
   */
  public static resetInstance(): void {
    ProviderRegistry.instance = null;
  }
}
