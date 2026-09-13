import { MemoryEntry, AgentRole } from '../types/index.ts';
import { generateId } from '../utils/id.ts';
import { AgentMemory } from '../agents/AgentMemory.ts';
import { PersistentAgentMemory } from '../agents/PersistentMemory.ts';
import { LocalSemanticMemoryStore, SemanticMemoryStore } from './SemanticMemory.ts';
import { RelevanceScorer, ScoredMemory } from './RelevanceScorer.ts';

export type MemoryLayer = 'working' | 'task' | 'persistent';

export interface LayeredMemoryOptions {
  agentId: string;
  agentRole?: AgentRole;
  maxWorkingEntries?: number;
  maxTaskEntries?: number;
  persistentStore?: AgentMemory;
  semanticStore?: SemanticMemoryStore;
}

/**
 * 4-Layer Memory System for Agent HQ:
 * 1. Working Memory: Immediate runtime scratchpad (decisions, transient thought traces).
 * 2. Task Memory: Scoped to the active task execution and flushed/summarized between tasks.
 * 3. Persistent Memory: Long-term durable storage backed by SQLite.
 * 4. Semantic Memory: Abstracted vector/lexical retrieval layer with multi-signal relevance scoring.
 */
export class LayeredMemory implements AgentMemory {
  public readonly agentId: string;
  public readonly agentRole?: AgentRole;

  private workingMemory: MemoryEntry[] = [];
  private taskMemory: MemoryEntry[] = [];
  private persistentMemory: AgentMemory;
  private semanticStore: SemanticMemoryStore;

  private readonly maxWorking: number;
  private readonly maxTask: number;

  constructor(options: LayeredMemoryOptions) {
    this.agentId = options.agentId;
    this.agentRole = options.agentRole;
    this.maxWorking = options.maxWorkingEntries ?? 20;
    this.maxTask = options.maxTaskEntries ?? 40;
    this.persistentMemory = options.persistentStore || new PersistentAgentMemory(options.agentId);
    this.semanticStore = options.semanticStore || new LocalSemanticMemoryStore();
  }

  /**
   * Remember an entry in a specified layer, indexing into semantic store.
   */
  public rememberLayer(
    layer: MemoryLayer,
    entry: Omit<MemoryEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: number }
  ): MemoryEntry {
    const fullEntry: MemoryEntry = {
      id: entry.id || generateId('mem'),
      timestamp: entry.timestamp || Date.now(),
      type: entry.type,
      content: entry.content,
      agentId: this.agentId,
      taskId: entry.taskId,
      sessionId: entry.sessionId,
      expiresAt: entry.expiresAt,
      metadata: {
        ...entry.metadata,
        layer,
        role: this.agentRole,
      },
    };

    switch (layer) {
      case 'working':
        this.workingMemory.unshift(fullEntry);
        if (this.workingMemory.length > this.maxWorking) {
          this.workingMemory.pop();
        }
        break;
      case 'task':
        this.taskMemory.unshift(fullEntry);
        if (this.taskMemory.length > this.maxTask) {
          this.taskMemory.pop();
        }
        break;
      case 'persistent':
      default:
        this.persistentMemory.remember(fullEntry);
        break;
    }

    // Index into semantic store asynchronously
    this.semanticStore.addEntry(fullEntry).catch(() => {});

    return fullEntry;
  }

  /**
   * Default AgentMemory interface implementation: defaults to persistent layer.
   */
  public remember(entry: Omit<MemoryEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: number }): MemoryEntry {
    return this.rememberLayer('persistent', entry);
  }

  /**
   * Query memories across all layers using multi-signal relevance scoring.
   */
  public queryRelevant(query: string, limit: number = 5): ScoredMemory[] {
    const allEntries = this.getAllEntries();
    return RelevanceScorer.scoreAndRank(allEntries, {
      query,
      agentId: this.agentId,
      agentRole: this.agentRole,
      maxEntries: limit,
    });
  }

  /**
   * Get all memory entries across working, task, and persistent layers.
   */
  public getAllEntries(): MemoryEntry[] {
    const persistentEntries = this.persistentMemory.recent(100);
    const seen = new Set<string>();
    const combined: MemoryEntry[] = [];

    for (const list of [this.workingMemory, this.taskMemory, persistentEntries]) {
      for (const entry of list) {
        if (!seen.has(entry.id)) {
          seen.add(entry.id);
          combined.push(entry);
        }
      }
    }

    return combined;
  }

  public getWorkingMemory(): MemoryEntry[] {
    return [...this.workingMemory];
  }

  public getTaskMemory(): MemoryEntry[] {
    return [...this.taskMemory];
  }

  public clearTaskMemory(): void {
    this.taskMemory = [];
  }

  public clearWorkingMemory(): void {
    this.workingMemory = [];
  }

  public recent(limit: number = 20): MemoryEntry[] {
    return this.getAllEntries().slice(0, limit);
  }

  public getByType(type: MemoryEntry['type']): MemoryEntry[] {
    return this.getAllEntries().filter((e) => e.type === type);
  }

  public clear(): void {
    this.workingMemory = [];
    this.taskMemory = [];
    this.persistentMemory.clear();
    this.semanticStore.clear().catch(() => {});
  }
}
