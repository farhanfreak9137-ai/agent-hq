import { AgentMemory } from './AgentMemory.ts';
import { MemoryEntry } from '../types/index.ts';
import { generateId } from '../utils/id.ts';
import { ApiClient } from '../services/ApiClient.ts';

/**
 * Durable agent memory backed by server-side persistence with a local session cache.
 * Implements retention rules (max entries, optional expiration) and separates task/session memory.
 */
export class PersistentAgentMemory implements AgentMemory {
  private entries: MemoryEntry[] = [];
  private readonly maxEntries: number;
  private readonly agentId: string;
  private apiClient: ApiClient = ApiClient.getInstance();

  constructor(agentId: string, maxEntries: number = 80) {
    this.agentId = agentId;
    this.maxEntries = maxEntries;
    this.loadInitialMemory();
  }

  private async loadInitialMemory(): Promise<void> {
    try {
      const serverEntries = await this.apiClient.getMemory(this.agentId, this.maxEntries);
      if (serverEntries && Array.isArray(serverEntries)) {
        this.entries = serverEntries;
      }
    } catch {
      // Offline fallback: retains local cache
    }
  }

  public remember(entry: Omit<MemoryEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: number }): MemoryEntry {
    const fullEntry: MemoryEntry = {
      id: entry.id || generateId('mem'),
      timestamp: entry.timestamp || Date.now(),
      type: entry.type,
      content: entry.content,
      agentId: this.agentId,
      taskId: entry.taskId,
      sessionId: entry.sessionId,
      expiresAt: entry.expiresAt,
      metadata: entry.metadata,
    };

    // 1. Add to local cache with retention limit
    this.entries.unshift(fullEntry);
    if (this.entries.length > this.maxEntries) {
      this.entries.pop();
    }

    // 2. Asynchronously persist to server
    this.apiClient.saveMemory({
      ...fullEntry,
      agentId: this.agentId,
    }).catch(() => {
      // Background persistence error handled silently
    });

    return fullEntry;
  }

  public recent(limit: number = 20): MemoryEntry[] {
    const now = Date.now();
    return this.entries
      .filter((e) => !e.expiresAt || e.expiresAt > now)
      .slice(0, limit);
  }

  public getByType(type: MemoryEntry['type']): MemoryEntry[] {
    const now = Date.now();
    return this.entries.filter((e) => e.type === type && (!e.expiresAt || e.expiresAt > now));
  }

  public clear(): void {
    this.entries = [];
  }
}
