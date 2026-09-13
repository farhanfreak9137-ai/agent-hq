import { MemoryEntry } from '../types/index.ts';
import { RelevanceScorer, ScoredMemory } from './RelevanceScorer.ts';

export interface SemanticQueryOptions {
  query: string;
  limit?: number;
  minScore?: number;
  agentId?: string;
}

/**
 * Provider-independent Semantic Memory interface.
 * Can be backed by local term-vector cosine similarity, TF-IDF,
 * or future external embedding providers (without coupling to any single vector DB).
 */
export interface SemanticMemoryStore {
  addEntry(entry: MemoryEntry): Promise<void>;
  search(options: SemanticQueryOptions): Promise<ScoredMemory[]>;
  clear(): Promise<void>;
}

/**
 * Deterministic in-memory semantic memory store using normalized lexical vector modeling.
 */
export class LocalSemanticMemoryStore implements SemanticMemoryStore {
  private entries: MemoryEntry[] = [];

  public async addEntry(entry: MemoryEntry): Promise<void> {
    this.entries.push(entry);
    if (this.entries.length > 200) {
      this.entries.shift();
    }
  }

  public async search(options: SemanticQueryOptions): Promise<ScoredMemory[]> {
    const limit = options.limit ?? 5;
    const minScore = options.minScore ?? 0.05;

    let candidateEntries = this.entries;
    if (options.agentId) {
      candidateEntries = candidateEntries.filter((e) => !e.agentId || e.agentId === options.agentId);
    }

    const scored = RelevanceScorer.scoreAndRank(candidateEntries, {
      query: options.query,
      agentId: options.agentId,
      maxEntries: limit,
    });

    return scored.filter((s) => s.score >= minScore);
  }

  public async clear(): Promise<void> {
    this.entries = [];
  }
}
