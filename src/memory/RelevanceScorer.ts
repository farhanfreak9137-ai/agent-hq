import { MemoryEntry, AgentRole } from '../types/index.ts';

export interface RelevanceScoreOptions {
  query: string;
  agentRole?: AgentRole;
  agentId?: string;
  tags?: string[];
  maxEntries?: number;
  halfLifeMs?: number; // default 30 minutes
}

export interface ScoredMemory {
  entry: MemoryEntry;
  score: number;
  signals: {
    similarity: number;
    recency: number;
    roleMatch: number;
    importance: number;
    tagMatch: number;
  };
}

/**
 * Multi-signal memory relevance scoring engine.
 * Computes deterministic relevance scores combining text similarity,
 * temporal decay, role alignment, importance weights, and tag overlap.
 */
export class RelevanceScorer {
  private static readonly DEFAULT_HALF_LIFE_MS = 30 * 60 * 1000; // 30 minutes

  /**
   * Tokenize text into normalized lowercase tokens, removing basic punctuation.
   */
  public static tokenize(text: string): Set<string> {
    if (!text) return new Set();
    const words = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);
    return new Set(words);
  }

  /**
   * Jaccard overlap similarity between query tokens and memory content tokens.
   */
  public static computeSimilarity(queryTokens: Set<string>, contentTokens: Set<string>): number {
    if (queryTokens.size === 0 || contentTokens.size === 0) return 0;
    let intersection = 0;
    for (const token of queryTokens) {
      if (contentTokens.has(token)) {
        intersection++;
      }
    }
    const union = new Set([...queryTokens, ...contentTokens]).size;
    return union > 0 ? intersection / union : 0;
  }

  /**
   * Temporal exponential decay score: e^(-lambda * deltaT).
   */
  public static computeRecency(timestamp: number, now: number, halfLifeMs: number): number {
    const delta = Math.max(0, now - timestamp);
    const lambda = Math.LN2 / halfLifeMs;
    return Math.exp(-lambda * delta);
  }

  /**
   * Score and rank an array of memory entries against a query context.
   */
  public static scoreAndRank(entries: MemoryEntry[], options: RelevanceScoreOptions): ScoredMemory[] {
    const now = Date.now();
    const halfLife = options.halfLifeMs ?? RelevanceScorer.DEFAULT_HALF_LIFE_MS;
    const queryTokens = RelevanceScorer.tokenize(options.query);
    const targetTags = new Set((options.tags || []).map((t) => t.toLowerCase()));

    const scored: ScoredMemory[] = entries.map((entry) => {
      const contentTokens = RelevanceScorer.tokenize(
        `${entry.content} ${entry.type} ${JSON.stringify(entry.metadata || {})}`
      );

      // Signal 1: Token similarity (0 to 1)
      const similarity = RelevanceScorer.computeSimilarity(queryTokens, contentTokens);

      // Signal 2: Recency decay (0 to 1)
      const recency = RelevanceScorer.computeRecency(entry.timestamp, now, halfLife);

      // Signal 3: Role / Agent alignment (0 or 1)
      let roleMatch = 0;
      if (options.agentId && entry.agentId === options.agentId) {
        roleMatch = 1.0;
      } else if (options.agentRole && entry.metadata && entry.metadata.role === options.agentRole) {
        roleMatch = 0.8;
      }

      // Signal 4: Importance weight (default 0.5, up to 1.0)
      const importanceRaw = typeof entry.metadata?.importance === 'number' ? entry.metadata.importance : 0.5;
      const importance = Math.max(0, Math.min(1.0, importanceRaw));

      // Signal 5: Tag overlap (0 to 1)
      let tagMatch = 0;
      if (targetTags.size > 0 && entry.metadata?.tags && Array.isArray(entry.metadata.tags)) {
        const entryTags = (entry.metadata.tags as string[]).map((t) => t.toLowerCase());
        const matched = entryTags.filter((t) => targetTags.has(t)).length;
        tagMatch = matched / targetTags.size;
      }

      // Composite weighted score:
      // Similarity: 0.35, Recency: 0.25, RoleMatch: 0.15, Importance: 0.15, TagMatch: 0.10
      const score =
        similarity * 0.35 +
        recency * 0.25 +
        roleMatch * 0.15 +
        importance * 0.15 +
        tagMatch * 0.1;

      return {
        entry,
        score: Math.round(score * 1000) / 1000,
        signals: {
          similarity,
          recency,
          roleMatch,
          importance,
          tagMatch,
        },
      };
    });

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    const limit = options.maxEntries ?? 10;
    return scored.slice(0, limit);
  }
}
