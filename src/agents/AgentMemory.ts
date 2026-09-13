import { MemoryEntry } from '../types/index.ts';
import { generateId } from '../utils/id.ts';

export interface AgentMemory {
  remember(entry: Omit<MemoryEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: number }): MemoryEntry;
  recent(limit?: number): MemoryEntry[];
  getByType(type: MemoryEntry['type']): MemoryEntry[];
  clear(): void;
}

/**
 * Lightweight, session-scoped in-memory store for an agent.
 * Tracks recent decisions, tool invocations, messages, and task outcomes.
 */
export class InMemoryAgentMemory implements AgentMemory {
  private entries: MemoryEntry[] = [];
  private readonly maxEntries: number;

  constructor(maxEntries: number = 60) {
    this.maxEntries = maxEntries;
  }

  public remember(entry: Omit<MemoryEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: number }): MemoryEntry {
    const fullEntry: MemoryEntry = {
      id: entry.id || generateId('mem'),
      timestamp: entry.timestamp || Date.now(),
      type: entry.type,
      content: entry.content,
      metadata: entry.metadata,
    };

    this.entries.unshift(fullEntry);
    if (this.entries.length > this.maxEntries) {
      this.entries.pop();
    }

    return fullEntry;
  }

  public recent(limit: number = 20): MemoryEntry[] {
    return this.entries.slice(0, limit);
  }

  public getByType(type: MemoryEntry['type']): MemoryEntry[] {
    return this.entries.filter((e) => e.type === type);
  }

  public clear(): void {
    this.entries = [];
  }
}
